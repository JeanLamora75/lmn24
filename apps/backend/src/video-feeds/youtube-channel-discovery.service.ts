import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const MAX_HTML = 1_500_000;

export function youtubeChannelFromHtml(html: string): string | null {
  for (const pattern of [
    /<meta\s+[^>]*itemprop=["']channelId["'][^>]*content=["'](UC[A-Za-z0-9_-]{22})["']/i,
    /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
  ]) {
    const found = html.match(pattern)?.[1];
    if (found && CHANNEL.test(found)) return found;
  }
  return null;
}

export function normalizeYouTubeLookup(raw: string): { channelId?: string; url?: string } {
  const value = raw.trim();
  if (CHANNEL.test(value)) return { channelId: value };
  const input = value.startsWith("@") ? "https://www.youtube.com/" + value : value;
  let url: URL;
  try { url = new URL(input); }
  catch { throw new BadRequestException("Indiquez un lien YouTube ou un identifiant de chaîne valide."); }
  if (url.protocol !== "https:" || !["www.youtube.com","youtube.com","m.youtube.com"].includes(url.hostname))
    throw new BadRequestException("Seuls les liens HTTPS vers YouTube sont acceptés.");
  const feedId = url.pathname === "/feeds/videos.xml" ? url.searchParams.get("channel_id") : null;
  const channelId = feedId ?? url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
  if (channelId && CHANNEL.test(channelId)) return { channelId };
  if (!/^\/@[A-Za-z0-9._-]{3,100}\/?$/.test(url.pathname) &&
      !/^\/(?:user|c)\/[A-Za-z0-9._-]{1,100}\/?$/.test(url.pathname))
    throw new BadRequestException("Format de chaîne YouTube non pris en charge. Utilisez un lien @handle ou /channel/UC…");
  url.hostname = "www.youtube.com";
  url.search = "";
  url.hash = "";
  return { url: url.toString() };
}

@Injectable()
export class YoutubeChannelDiscoveryService {
  constructor(private readonly database: DatabaseService) {}

  async resolve(input: { sourceId?: string | undefined; query?: string | undefined }): Promise<{ channelId: string; feedUrl: string }> {
    let candidate = input.query?.trim();
    if (!candidate && input.sourceId) {
      const source = await this.database.prisma.source.findUnique({ where: { id: input.sourceId }, select: { youtubeUrl: true } });
      if (!source) throw new NotFoundException("Source introuvable.");
      candidate = source.youtubeUrl?.trim() ?? "";
    }
    if (!candidate) throw new BadRequestException("Aucun lien YouTube renseigné pour cette source. Collez son URL @handle dans le champ.");
    const normalized = normalizeYouTubeLookup(candidate);
    let channelId = normalized.channelId;
    if (!channelId && normalized.url) {
      const response = await fetch(normalized.url, {
        redirect: "manual", signal: AbortSignal.timeout(10000),
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; LMN24/1.0)" },
      });
      if (!response.ok) throw new UnprocessableEntityException("Impossible de consulter cette chaîne YouTube.");
      const length = Number(response.headers.get("content-length"));
      if (length > MAX_HTML) throw new UnprocessableEntityException("Page YouTube trop volumineuse.");
      if (!response.body) throw new UnprocessableEntityException("Réponse YouTube vide.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_HTML) throw new UnprocessableEntityException("Page YouTube trop volumineuse.");
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      channelId = youtubeChannelFromHtml(new TextDecoder().decode(bytes)) ?? undefined;
    }
    if (!channelId) throw new UnprocessableEntityException("Identifiant introuvable sur YouTube. Renseignez manuellement le channel_id.");
    return { channelId, feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId };
  }
}
