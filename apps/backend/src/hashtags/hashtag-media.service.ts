import {
  BadGatewayException, BadRequestException, GatewayTimeoutException,
  HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { getCACertificates } from "node:tls";
import sharp from "sharp";

const PREFIX = "/api/media/hashtags/";

// Node's bundled CAs do not necessarily contain the enterprise HTTPS root
// already trusted by Windows. Include BOTH trusted CA stores for this
// outgoing request, without turning off TLS verification or hostname checks.
const IMAGE_HTTPS_CA = [...new Set([
  ...getCACertificates("default"), ...getCACertificates("system"),
])];

const TLS_CERTIFICATE_CODES = new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function imageDownloadError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : "";
  if (TLS_CERTIFICATE_CODES.has(code)) {
    return new BadGatewayException(
      "Le certificat HTTPS du site d’image n’est pas reconnu. " +
      "Vérifiez les certificats racines approuvés par Windows ou le proxy de votre réseau.",
    );
  }
  if (["ETIMEDOUT", "ESOCKETTIMEDOUT", "ERR_SOCKET_TIMEOUT"].includes(code)) {
    return new GatewayTimeoutException(
      "Le serveur de l’image ne répond pas assez vite. Réessayez ou utilisez un autre lien.",
    );
  }
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET",
    "EHOSTUNREACH", "ENETUNREACH", "EPIPE"].includes(code)) {
    return new BadGatewayException(
      "Impossible de joindre le serveur de l’image. " +
      "Vérifiez que le lien est public et accessible depuis le serveur LMN24.",
    );
  }
  return new BadGatewayException(
    "Le téléchargement de l’image a échoué. " +
    "Utilisez un lien HTTPS direct vers une image JPEG, PNG ou WebP.",
  );
}
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
      !url.hostname || url.hostname.includes(":") || url.hostname.includes("[") || url.hostname.endsWith(".local") || url.hostname === "localhost" ||
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
      ca: IMAGE_HTTPS_CA,
      rejectUnauthorized: true,
      headers: { Accept: "image/webp,image/png,image/jpeg", "User-Agent": "LMN24-HashtagImage/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const target = res.headers.location;
        res.resume();
        if (!target) { rejectRequest(new BadRequestException("Redirection de l'image invalide.")); return; }
        try { resolveRequest({ redirect: new URL(target, url).toString() }); }
        catch { rejectRequest(new BadRequestException("Redirection invalide.")); }
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
      res.on("error", (error: Error) => rejectRequest(imageDownloadError(error)));
      res.on("aborted", () => rejectRequest(new BadGatewayException(
        "Le serveur distant a interrompu le téléchargement de l’image.",
      )));
    });
    req.on("timeout", () => req.destroy(new GatewayTimeoutException(
      "Le serveur de l’image ne répond pas assez vite.",
    )));
    req.on("error", (error: Error) => rejectRequest(imageDownloadError(error)));
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
      let result: Awaited<ReturnType<typeof downloadStep>>;
      try { result = await downloadStep(current); }
      catch (error) { throw imageDownloadError(error); }
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
    try {
      await mkdir(this.mediaDir, { recursive: true });
      const name = randomUUID() + ".webp";
      await writeFile(resolve(this.mediaDir, name), data, { flag: "wx" });
      return PREFIX + name;
    } catch (error) {
      this.logger.error(
        "Impossible de stocker une image hashtag : " +
        (error instanceof Error ? error.message : String(error)),
      );
      throw new ServiceUnavailableException(
        "Stockage de l’image indisponible. Vérifiez les droits d’écriture " +
        "du répertoire des images Hashtags.",
      );
    }
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
