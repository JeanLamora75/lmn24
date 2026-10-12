import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

type ListQuery = { search?: string | undefined; sourceId?: string | undefined; categoryId?: string | undefined; language?: string | undefined;
  status: "all" | "published" | "hidden"; page: number; pageSize: number };
@Injectable()
export class VideosService {
  constructor(private readonly db: DatabaseService) {}
  async list(query: ListQuery) {
    const where = {
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.language ? { languageIsoCode2: query.language } : {}),
      ...(query.status === "published" ? { isPublished: true } :
        query.status === "hidden" ? { isPublished: false } : {}),
      ...(query.search ? { OR: [
        { title: { contains: query.search, mode: "insensitive" as const } },
        { source: { name: { contains: query.search, mode: "insensitive" as const } } },
        { platformVideoId: { contains: query.search, mode: "insensitive" as const } },
      ] } : {}),
    };
    const total = await this.db.prisma.video.count({ where });
    const totalPages = Math.ceil(total / query.pageSize);
    const page = Math.min(query.page, Math.max(totalPages, 1));
    const items = await this.db.prisma.video.findMany({
      where, skip: (page - 1) * query.pageSize, take: query.pageSize,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, description: true, thumbnailUrl: true, videoUrl: true,
        platformVideoId: true, publishedAt: true, createdAt: true, isPublished: true,
        sourceId: true, categoryId: true, languageIsoCode2: true, feedVideoId: true,
        source: { select: { name: true, country: { select: { isoCode2: true } } } },
        category: { select: { slug: true } },
        feedVideo: { select: { channelId: true } },
      },
    });
    return { items, pagination: { total, page, pageSize: query.pageSize, totalPages } };
  }
  async get(id: string) {
    const item = await this.db.prisma.video.findUnique({ where: { id },
      include: { source: { select: { name: true } }, category: { select: { slug: true } } } });
    if (!item) throw new NotFoundException("Vidéo introuvable.");
    return item;
  }
  async options() {
    const [sources, categories, languages] = await Promise.all([
      this.db.prisma.source.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.db.prisma.category.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } }),
      this.db.prisma.language.findMany({ orderBy: { isoCode2: "asc" }, select: { isoCode2: true } }),
    ]);
    return { sources, categories, languages };
  }
  async update(id: string, input: { categoryId: string; languageIsoCode2: string; isPublished: boolean }) {
    await this.get(id);
    const [category, language] = await Promise.all([
      this.db.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      this.db.prisma.language.findUnique({ where: { isoCode2: input.languageIsoCode2 }, select: { isoCode2: true } }),
    ]);
    if (!category || !language) throw new BadRequestException("Catégorie ou langue inconnue.");
    return this.db.prisma.video.update({ where: { id }, data: input, select: { id: true, categoryId: true,
      languageIsoCode2: true, isPublished: true } });
  }
  async publish(id: string, isPublished: boolean) {
    await this.get(id);
    return this.db.prisma.video.update({ where: { id }, data: { isPublished },
      select: { id: true, isPublished: true } });
  }
}
