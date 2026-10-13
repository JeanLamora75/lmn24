import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { resolve } from "node:path";
import sharp from "sharp";

const PREFIX = "/api/media/hashtags/";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const IMAGE_TYPES = new Set(["jpeg", "png", "webp"]);
const MEDIA_NAME = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.webp$/i;

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b, c] = parts as [number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 100 && b >= 64 && b <= 127 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 || b === 88) ||
      a === 198 && (b === 18 || b === 19) || a === 192 && b === 0 && c === 2 ||
      a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function validatePublicImageUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadRequestException("URL de l'image invalide."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" ||
      !url.hostname || url.hostname.endsWith(".local") || url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") || isIP(url.hostname) === 6) {
    throw new BadRequestException("Utilisez une URL HTTPS publique sans identifiants.");
  }
  if (isIP(url.hostname) === 4 && !isPublicIPv4(url.hostname)) {
    throw new BadRequestException("Les adresses réseau privées sont interdites.");
  }
  return url;
}

async function approvedAddress(hostname: string): Promise<string> {
  try {
    // Pin the validated IPv4 address in the actual TLS connection; do not
    // let the HTTPS client resolve DNS a second time (DNS rebinding).
    const addresses = await lookup(hostname, { family: 4, all: true });
    if (!addresses.length || addresses.some((r) => !isPublicIPv4(r.address))) {
      throw new Error("blocked");
    }
    return addresses[0]!.address;
  } catch {
    throw new BadRequestException("Adresse IP non publique ou domaine inaccessible.");
  }
}

async function downloadStep(url: URL): Promise<{ buffer?: Buffer; redirect?: string }> {
  const address = await approvedAddress(url.hostname);
  return new Promise((resolveRequest, rejectRequest) => {
    const req = httpsRequest(url, {
      timeout: 8000,
      headers: { Accept: "image/webp,image/png,image/jpeg", "User-Agent": "LMN24-HashtagImage/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const target = res.headers.location;
        res.resume();
        if (!target) { rejectRequest(new BadRequestException("Redirection de l'image invalide.")); return; }
        resolveRequest({ redirect: new URL(target, url).toString() });
        return;
      }
      if (status !== 200) {
        res.resume();
        rejectRequest(new BadRequestException("Téléchargement de l'image refusé par le serveur distant."));
        return;
      }
      const type = String(res.headers["content-type"] ?? "").split(";")[0]?.toLowerCase();
      if (type && !["image/jpeg", "image/png", "image/webp", "application/octet-stream"].includes(type)) {
        res.resume(); rejectRequest(new BadRequestException("L'URL ne retourne pas une image autorisée.")); return;
      }
      const declared = Number(res.headers["content-length"] ?? "0");
      if (declared > MAX_BYTES) {
        res.destroy(); rejectRequest(new BadRequestException("Image trop volumineuse (8 Mo maximum).")); return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          res.destroy(new BadRequestException("Image trop volumineuse (8 Mo maximum)."));
        } else chunks.push(chunk);
      });
      res.on("end", () => resolveRequest({ buffer: Buffer.concat(chunks) }));
      res.on("error", rejectRequest);
    });
    req.on("timeout", () => req.destroy(new BadRequestException("Téléchargement trop long.")));
    req.on("error", rejectRequest);
    req.end();
  });
}

@Injectable()
export class HashtagMediaService {
  private readonly mediaDir: string;
  private readonly logger = new Logger(HashtagMediaService.name);

  constructor(config: ConfigService) {
    this.mediaDir = resolve(config.get<string>("HASHTAG_MEDIA_DIR")?.trim()
      || resolve(process.cwd(), "uploads", "hashtags"));
  }

  async importFromUrl(raw: string): Promise<string> {
    let current = validatePublicImageUrl(raw);
    for (let i = 0; i <= 3; i += 1) {
      const result = await downloadStep(current);
      if (result.buffer) return this.storeImage(result.buffer);
      if (!result.redirect || i === 3) break;
      current = validatePublicImageUrl(result.redirect);
    }
    throw new BadRequestException("Trop de redirections pour l'image.");
  }

  async storeImage(buffer: Buffer): Promise<string> {
    if (!buffer.length || buffer.length > MAX_BYTES) {
      throw new BadRequestException("Image trop volumineuse ou vide (8 Mo maximum).");
    }
    let data: Buffer;
    try {
      const metadata = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
      if (!metadata.format || !IMAGE_TYPES.has(metadata.format) || !metadata.width || !metadata.height) {
        throw new Error("Unsupported image");
      }
      data = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" })
        .rotate().resize({ width: 1200, height: 675, fit: "cover", withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 }).toBuffer();
    } catch {
      throw new BadRequestException("Image invalide. Utilisez JPEG, PNG ou WebP.");
    }
    await mkdir(this.mediaDir, { recursive: true });
    const name = randomUUID() + ".webp";
    await writeFile(resolve(this.mediaDir, name), data, { flag: "wx" });
    return PREFIX + name;
  }

  async readImage(name: string): Promise<Buffer> {
    if (!MEDIA_NAME.test(name)) throw new NotFoundException("Image introuvable.");
    try { return await readFile(resolve(this.mediaDir, name)); }
    catch { throw new NotFoundException("Image introuvable."); }
  }

  isManagedImage(url: string | null | undefined): boolean {
    return Boolean(url?.startsWith(PREFIX) && MEDIA_NAME.test(url.slice(PREFIX.length)));
  }

  async deleteLocalImage(url: string | null | undefined): Promise<void> {
    if (!this.isManagedImage(url)) return;
    try { await unlink(resolve(this.mediaDir, url!.slice(PREFIX.length))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("Unable to remove an old hashtag image; maintenance may retry.");
      }
    }
  }
}
