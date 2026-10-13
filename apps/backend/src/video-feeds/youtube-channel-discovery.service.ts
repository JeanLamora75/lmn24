import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chromium } from "playwright";
import { DatabaseService } from "../database/database.service";

const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const MAX_HTML = 4_000_000;
const CHANNEL_PAGE_TIMEOUT_MS = 10_000;
const SUPPORTED_YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const MANUAL_HINT = "Ouvrez la chaîne dans Chrome puis collez son adresse /channel/UC… ou son identifiant UC… dans le formulaire.";

function isApprovedYouTubeUrl(url: URL): boolean {
  return url.protocol === "https:" &&
    SUPPORTED_YOUTUBE_HOSTS.has(url.hostname.toLowerCase()) &&
    !url.username && !url.password && (!url.port || url.port === "443");
}

function channelFromMetadata(html: string): string | null {
  // YouTube often publishes its canonical channel ID as an App Links URL
  // rather than itemprop=channelId. Accept only channel URLs on youtube.com,
  // never arbitrary deep links, video IDs or a lookalike host.
  const appLinkProperties = new Set([
    "al:ios:url", "al:android:url", "al:web:url",
    "twitter:app:url:iphone", "twitter:app:url:ipad",
    "twitter:app:url:googleplay",
  ]);
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = tag.match(/(?:^|\s)(?:property|name)\s*=\s*(["'])(.*?)\1/i)?.[2]?.toLowerCase();
    if (!property || !appLinkProperties.has(property)) continue;
    const content = tag.match(/(?:^|\s)content\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim();
    if (!content) continue;
    const channelId = content.match(
      /^(?:vnd\.youtube|https):\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})(?=$|[/?#])/i,
    )?.[1];
    if (channelId && CHANNEL.test(channelId)) return channelId;
  }

  const patterns = [
    /<meta\b(?=[^>]*\bitemprop=["']channelId["'])(?=[^>]*\bcontent=["'](UC[A-Za-z0-9_-]{22})["'])[^>]*>/i,
    /<meta\b(?=[^>]*\bcontent=["'](UC[A-Za-z0-9_-]{22})["'])(?=[^>]*\bitemprop=["']channelId["'])[^>]*>/i,
    /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22}))/i,
    /<meta\b(?=[^>]*\bproperty=["']og:url["'])(?=[^>]*\bcontent=["']https:\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22}))/i,
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found && CHANNEL.test(found)) return found;
  }
  return null;
}

export function youtubeChannelFromHtml(html: string): string | null {
  return channelFromMetadata(html);
}

export function normalizeYouTubeLookup(raw: string): { channelId?: string; url?: string } {
  const value = raw.trim();
  if (/^<meta\b/i.test(value)) {
    const channelId = youtubeChannelFromHtml(value);
    if (channelId) return { channelId };
    throw new BadRequestException("La balise HTML collée ne contient pas de channel_id YouTube valide. Copiez la balise al:ios:url ou al:android:url de la page de chaîne.");
  }
  if (CHANNEL.test(value)) return { channelId: value };
  const input = value.startsWith("@") ? "https://www.youtube.com/" + value : value;
  let url: URL;
  try { url = new URL(input); }
  catch { throw new BadRequestException("Indiquez une URL YouTube valide, un @handle ou un identifiant UC…."); }
  if (!isApprovedYouTubeUrl(url))
    throw new BadRequestException("Seules les adresses HTTPS officielles de youtube.com sont autorisées.");

  const feedId = url.pathname === "/feeds/videos.xml" ? url.searchParams.get("channel_id") : null;
  const pathId = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/.*)?$/)?.[1];
  const channelId = feedId ?? pathId;
  if (channelId && CHANNEL.test(channelId)) return { channelId };
  if (!/^\/@[A-Za-z0-9._-]{3,100}(?:\/(?:videos|featured|about|shorts|streams|playlists))?\/?$/.test(url.pathname) &&
      !/^\/(?:user|c)\/[A-Za-z0-9._-]{1,100}(?:\/(?:videos|featured|about|shorts|streams|playlists))?\/?$/.test(url.pathname))
    throw new BadRequestException("Adresse YouTube non prise en charge. Collez @handle, /channel/UC… ou le channel_id.");

  url.hostname = "www.youtube.com";
  url.search = "";
  url.hash = "";
  return { url: url.toString() };
}

async function readBoundedHtml(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_HTML) throw new UnprocessableEntityException("La page YouTube est trop volumineuse.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML) throw new UnprocessableEntityException("La page YouTube est trop volumineuse.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function resolveRedirect(from: string, location: string): string | null {
  try {
    const target = new URL(location, from);
    return isApprovedYouTubeUrl(target) ? target.toString() : null;
  } catch {
    return null;
  }
}

type OfficialChannelLookup = { filter: "forHandle" | "forUsername"; value: string };

function officialChannelLookup(url: string): OfficialChannelLookup | null {
  const path = new URL(url).pathname;
  const handle = path.match(/^\/(@[A-Za-z0-9._-]{3,100})(?:\/(?:videos|featured|about|shorts|streams|playlists))?\/?$/);
  if (handle?.[1]) return { filter: "forHandle", value: handle[1] };
  const username = path.match(/^\/user\/([A-Za-z0-9._-]{1,100})(?:\/(?:videos|featured|about|shorts|streams|playlists))?\/?$/);
  if (username?.[1]) return { filter: "forUsername", value: username[1] };
  return null;
}

/**
 * Supported by YouTube Data API v3: channels.list(part=id, forHandle=...).
 * Unlike channel HTML scraping, this endpoint explicitly resolves handles.
 * The key is read only on the backend; never send it to a client or log it.
 */
async function lookupWithOfficialApi(
  lookup: OfficialChannelLookup,
  apiKey: string,
): Promise<{ channelId: string | null; error: string | null }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set(lookup.filter, lookup.value);
  url.searchParams.set("key", apiKey);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(9_000),
      redirect: "error",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      const hint = response.status === 400 || response.status === 401 || response.status === 403
        ? " Vérifiez la clé YOUTUBE_API_KEY, l'activation de YouTube Data API v3 et les quotas Google Cloud."
        : " Réessayez ultérieurement.";
      return { channelId: null, error: "API officielle YouTube (HTTP " + response.status + ")." + hint };
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("items" in data)) {
      return { channelId: null, error: "L'API YouTube a renvoyé une réponse inattendue." };
    }
    const items = (data as { items: unknown }).items;
    if (!Array.isArray(items) || items.length === 0) return { channelId: null, error: null };
    const first: unknown = items[0];
    if (!first || typeof first !== "object" || !("id" in first) ||
      typeof (first as { id: unknown }).id !== "string") {
      return { channelId: null, error: "L'API YouTube n'a pas renvoyé d'identifiant valide." };
    }
    const id = (first as { id: string }).id;
    return CHANNEL.test(id)
      ? { channelId: id, error: null }
      : { channelId: null, error: "L'identifiant de chaîne renvoyé par YouTube est invalide." };
  } catch {
    return { channelId: null, error: "Impossible de contacter l'API YouTube (réseau ou délai dépassé)." };
  }
}

async function lookupWithFetch(url: string): Promise<string | null> {
  let target = url;
  for (let redirects = 0; redirects < 3; redirects++) {
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(CHANNEL_PAGE_TIMEOUT_MS),
      headers: { accept: "text/html" },
    });
    if (response.status === 429) {
      throw new HttpException("YouTube limite les requêtes pour le moment. Réessayez plus tard.", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location ? resolveRedirect(target, location) : null;
      if (!next) return null;
      const direct = normalizeYouTubeLookup(next);
      if (direct.channelId) return direct.channelId;
      target = next;
      continue;
    }
    if (!response.ok) return null;
    return youtubeChannelFromHtml(await readBoundedHtml(response));
  }
  return null;
}

/**
 * A normal Chrome/Chromium visit is a fallback when Node fetch cannot read
 * YouTube's public channel metadata. It does not reuse private browser
 * sessions, evade challenges, solve CAPTCHAs or access third-party hosts.
 */
async function lookupWithBrowser(url: string): Promise<string | null> {
  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    try {
      await context.route("**/*", async route => {
        const requestUrl = route.request().url();
        if (
          (requestUrl.startsWith("data:") || requestUrl.startsWith("about:")) &&
          route.request().resourceType() !== "document"
        ) {
          await route.continue();
          return;
        }
        try {
          const target = new URL(requestUrl);
          if (isApprovedYouTubeUrl(target)) await route.continue();
          else await route.abort("blockedbyclient");
        } catch {
          await route.abort("blockedbyclient");
        }
      });
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: CHANNEL_PAGE_TIMEOUT_MS });
      if (!response || !response.ok()) return null;
      const final = new URL(page.url());
      if (!isApprovedYouTubeUrl(final)) return null;
      const direct = normalizeYouTubeLookup(final.toString());
      if (direct.channelId) return direct.channelId;
      // Read the public document, not contents from unrelated social links.
      const html = (await page.content()).slice(0, MAX_HTML);
      return youtubeChannelFromHtml(html);
    } finally {
      await context.close();
    }
  } catch {
    return null;
  } finally {
    await browser?.close();
  }
}

@Injectable()
export class YoutubeChannelDiscoveryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async resolve(input: { sourceId?: string | undefined; query?: string | undefined }): Promise<{ channelId: string; feedUrl: string }> {
    let candidate = input.query?.trim();
    if (!candidate && input.sourceId) {
      const source = await this.database.prisma.source.findUnique({
        where: { id: input.sourceId }, select: { youtubeUrl: true },
      });
      if (!source) throw new NotFoundException("Source introuvable.");
      candidate = source.youtubeUrl?.trim() ?? "";
    }
    if (!candidate) {
      throw new BadRequestException("Aucun compte YouTube associé à cette source. Collez son URL @handle ou son identifiant UC….");
    }
    const normalized = normalizeYouTubeLookup(candidate);
    let channelId = normalized.channelId;
    let officialError: string | null = null;
    if (!channelId && normalized.url) {
      const apiKey = this.config.get<string>("YOUTUBE_API_KEY")?.trim();
      const lookup = officialChannelLookup(normalized.url);
      if (apiKey && lookup) {
        const result = await lookupWithOfficialApi(lookup, apiKey);
        channelId = result.channelId ?? undefined;
        officialError = result.error;
      }
      if (!channelId) try {
        channelId = await lookupWithFetch(normalized.url) ?? undefined;
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw error;
        // Recover with standard Chrome/Chromium when the public HTTP request fails.
      }
      if (!channelId) channelId = await lookupWithBrowser(normalized.url) ?? undefined;
    }
    if (!channelId) {
      throw new UnprocessableEntityException(
        "La recherche automatique n'a pas pu obtenir le channel_id de cette chaîne. " +
        (officialError ? officialError + " " : "") + MANUAL_HINT,
      );
    }
    return {
      channelId,
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId,
    };
  }
}
