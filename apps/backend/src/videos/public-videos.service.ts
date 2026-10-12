import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
type Filters = { locale: string; categoryId?: string | undefined; sourceId?: string | undefined;
  country?: string | undefined; cursor?: string | undefined; limit: number };
type Cursor = { publishedAt: Date; id: string };
export function decodeVideoCursor(raw: string): Cursor {
  try {
    if (!/^[a-zA-Z0-9_-]{1,256}$/.test(raw)) throw new Error("Invalid cursor");
    const data: unknown = JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
    if (!Array.isArray(data) || data.length!==2 || typeof data[0]!=="string" ||
      typeof data[1]!=="string" || !/^[0-9a-f-]{36}$/i.test(data[1])) throw new Error("Invalid cursor");
    const date=new Date(data[0]);
    if (!Number.isFinite(date.getTime()) || date.toISOString()!==data[0]) throw new Error("Invalid date");
    return {publishedAt:date,id:data[1]};
  } catch { throw new BadRequestException("Curseur vidéo invalide."); }
}
function encodeVideoCursor(cursor:Cursor):string {
  return Buffer.from(JSON.stringify([cursor.publishedAt.toISOString(),cursor.id]),"utf8").toString("base64url");
}
@Injectable()
export class PublicVideosService {
  constructor(private readonly db: DatabaseService) {}
  async filters(locale:string) {
    const [categories,sources] = await Promise.all([
      this.db.prisma.category.findMany({
        where:{isActive:true,videos:{some:{languageIsoCode2:locale,isPublished:true,source:{isActive:true}}}},
        orderBy:{displayOrder:"asc"},select:{id:true,slug:true,displayOrder:true,themeColor:true},
      }),
      this.db.prisma.source.findMany({
        where:{isActive:true,videos:{some:{languageIsoCode2:locale,isPublished:true,category:{isActive:true}}}},
        orderBy:{name:"asc"}, select:{id:true,name:true,country:{select:{isoCode2:true}}},
      }),
    ]);
    const countries=[...new Set(sources.map(x=>x.country.isoCode2.trim()))].sort();
    return {categories,sources,countries};
  }
  async list(filters:Filters) {
    const cursor=filters.cursor?decodeVideoCursor(filters.cursor):null;
    const where={
      languageIsoCode2:filters.locale,isPublished:true,
      source:{isActive:true,...(filters.country?{country:{isoCode2:filters.country}}:{})},
      category:{isActive:true},
      ...(filters.categoryId?{categoryId:filters.categoryId}:{}),
      ...(filters.sourceId?{sourceId:filters.sourceId}:{}),
      ...(cursor?{OR:[{publishedAt:{lt:cursor.publishedAt}},
        {publishedAt:cursor.publishedAt,id:{lt:cursor.id}}]}:{}),
    };
    const rows=await this.db.prisma.video.findMany({
      where,take:filters.limit+1,orderBy:[{publishedAt:"desc"},{id:"desc"}],
      select:{id:true,title:true,description:true,thumbnailUrl:true,videoUrl:true,
        publishedAt:true,category:{select:{id:true,slug:true,displayOrder:true,themeColor:true}},
        source:{select:{id:true,name:true,country:{select:{isoCode2:true}}}}},
    });
    const hasMore=rows.length>filters.limit;
    const page=rows.slice(0,filters.limit);
    const last=page.at(-1);
    return {items:page,hasMore,nextCursor:hasMore&&last?encodeVideoCursor({publishedAt:last.publishedAt,id:last.id}):null};
  }
}
