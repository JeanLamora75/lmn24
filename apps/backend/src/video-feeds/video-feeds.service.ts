import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { VideoFeedInput, VideoFeedList } from "./video-feeds.schemas";

@Injectable()
export class VideoFeedsService {
  constructor(private readonly database: DatabaseService) {}
  async list(query: VideoFeedList) {
    const where = {
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.language ? { languageIsoCode2: query.language } : {}),
      ...(query.status !== "all" ? { isActive: query.status === "active" } : {}),
      ...(query.search ? { OR: [
        { channelId: { contains: query.search, mode: "insensitive" as const } },
        { source: { name: { contains: query.search, mode: "insensitive" as const } } },
      ] } : {}),
    };
    const [total, items] = await Promise.all([
      this.database.prisma.feedVideo.count({ where }),
      this.database.prisma.feedVideo.findMany({
        where, orderBy: [{ source: { name: "asc" } }, { channelId: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        include: {
          source: { select: { id: true, name: true } },
          category: { select: { id: true, slug: true } },
          language: { select: { isoCode2: true } },
          runs: { take: 1, orderBy: [{ startedAt: "desc" }, { id: "desc" }],
            select: { startedAt: true, status: true, errorMessage: true, videosImported: true, itemsFound: true } },
          _count: { select: { videos: true, runs: true } },
        },
      }),
    ]);
    return { items: items.map(({ runs, ...item }) => ({ ...item, lastRun: runs[0] ?? null })),
      pagination: { total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) } };
  }
  async formOptions() {
    const [sources, categories, languages] = await Promise.all([
      this.database.prisma.source.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, youtubeUrl: true } }),
      this.database.prisma.category.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } }),
      this.database.prisma.language.findMany({ orderBy: { isoCode2: "asc" }, select: { isoCode2: true } }),
    ]);
    return { sources, categories, languages };
  }
  async get(id: string) {
    const found = await this.database.prisma.feedVideo.findUnique({ where: { id },
      include: { source: { select: { name: true } }, category: { select: { slug: true } },
        runs: { take: 10, orderBy: { startedAt: "desc" } }, _count: { select: { videos: true, runs: true } } } });
    if (!found) throw new NotFoundException("Flux vidéo introuvable.");
    return found;
  }
  async create(input: VideoFeedInput) {
    await this.assertReferences(input);
    await this.assertUnique(input);
    try {
      return await this.database.prisma.feedVideo.create({ data: { ...input, platform: "YOUTUBE" }, select: { id: true } });
    } catch (error) { this.rethrowConflict(error); throw error; }
  }
  async update(id: string, input: VideoFeedInput) {
    await this.get(id);
    await this.assertReferences(input);
    await this.assertUnique(input, id);
    try {
      return await this.database.prisma.feedVideo.update({ where: { id }, data: input, select: { id: true } });
    } catch (error) { this.rethrowConflict(error); throw error; }
  }
  async updateStatus(id: string, isActive: boolean) {
    await this.get(id);
    return this.database.prisma.feedVideo.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
  }
  async remove(id: string) {
    const current = await this.get(id);
    if (current._count.runs > 0 || current._count.videos > 0)
      throw new ConflictException("Ce flux possède des vidéos ou un historique. Désactivez-le plutôt que de le supprimer.");
    try {
      await this.database.prisma.feedVideo.delete({ where: { id } });
      return { deleted: true };
    } catch (error) { this.rethrowConflict(error); throw error; }
  }
  private async assertReferences(input: VideoFeedInput) {
    const [source, category, language] = await Promise.all([
      this.database.prisma.source.findUnique({ where: { id: input.sourceId }, select: { id: true } }),
      this.database.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      this.database.prisma.language.findUnique({ where: { isoCode2: input.languageIsoCode2 }, select: { isoCode2: true } }),
    ]);
    if (!source || !category || !language) throw new BadRequestException("Source, catégorie ou langue inconnue.");
  }
  private async assertUnique(input: VideoFeedInput, excludeId?: string) {
    const existing = await this.database.prisma.feedVideo.findFirst({
      where: { ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ feedUrl: input.feedUrl }, { platform: "YOUTUBE", channelId: input.channelId }] },
      select: { id: true },
    });
    if (existing) throw new ConflictException("Cette chaîne ou URL de flux vidéo existe déjà.");
  }
  private rethrowConflict(error: unknown): void {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      throw new ConflictException("Cette chaîne ou URL de flux vidéo existe déjà.");
  }
}
