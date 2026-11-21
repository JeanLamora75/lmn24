import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { localDayBounds } from "./tv-import-time";
import {
  assertTvDay,gapsInDay,stateForChannel,todayInZone,
  type TvAiring,type TvPublicTab,type CoverageEvidence,TV_LANGUAGES,
} from "./tv-public-policy";

type CountryRow={id:string;isoCode2:string;referenceTimeZone:string};
type ChannelRow={
  id:string;channelId:string;name:string;number:number;logoUrl:string|null;
  countryId:string;countryIso2:string;referenceTimeZone:string;
  defaultVariantId:string|null;variantId:string|null;variantTimeZone:string|null;
  broadcastLanguages:string[];
};
type AiringRow={
  id:string;variantId:string;sourceId:string;startsAt:Date;endsAt:Date;
  title:string;category:string|null;description:string|null;imageUrl:string|null;
};
type VariantRow={id:string;code:string;name:string;timeZone:string};
const numberSort=(a:ChannelRow,b:ChannelRow)=>a.number-b.number
 ||a.name.localeCompare(b.name,"en")||a.channelId.localeCompare(b.channelId);
function serializeAirings(rows:readonly AiringRow[]):TvAiring[]{
  return rows.map(a=>({
    id:a.id,variantId:a.variantId,sourceId:a.sourceId,
    startsAt:new Date(a.startsAt).toISOString(),endsAt:new Date(a.endsAt).toISOString(),
    title:a.title,category:a.category,description:a.description,imageUrl:a.imageUrl,
  }));
}

@Injectable()
export class TvPublicService {
  constructor(private readonly db:DatabaseService){}
  private async requireSchema():Promise<void>{
    const rows=await this.db.prisma.$queryRaw<Array<{ready:boolean}>>`
      SELECT to_regclass('public.tv_country') IS NOT NULL
         AND to_regclass('public.tv_channel_country') IS NOT NULL
         AND to_regclass('public.tv_schedule_current') IS NOT NULL AS ready`;
    if(!rows[0]?.ready)throw new ServiceUnavailableException("TV_PUBLIC_SCHEMA_UNAVAILABLE");
  }
  async countries():Promise<CountryRow[]>{
    await this.requireSchema();
    return this.db.prisma.$queryRaw<CountryRow[]>`
      SELECT tc.country_id AS id,trim(c.iso_code2) AS "isoCode2",
        tc.reference_timezone AS "referenceTimeZone"
      FROM public.tv_country tc JOIN public.country c ON c.id=tc.country_id
      WHERE tc.is_active=TRUE AND c.is_active=TRUE
      ORDER BY c.iso_code2,tc.country_id`;
  }
  async country(iso2:string):Promise<CountryRow>{
    const rows=await this.countries();
    const found=rows.find(c=>c.isoCode2.toUpperCase()===iso2.toUpperCase());
    if(!found)throw new NotFoundException("TV_NOT_FOUND");
    return found;
  }
  private async channelRows(country:CountryRow):Promise<ChannelRow[]>{
    const rows=await this.db.prisma.$queryRaw<ChannelRow[]>`
      SELECT cc.id,cc.channel_id AS "channelId",ch.name,
        COALESCE(cc.manual_number,cc.official_number,cc.assigned_number)::int AS number,
        -- No provenance binding for imported channel logos in the 19-table
        -- candidate: do not assign unrelated source rights to a logo.
        NULL::text AS "logoUrl",
        cc.country_id AS "countryId",trim(c.iso_code2) AS "countryIso2",
        tc.reference_timezone AS "referenceTimeZone",
        COALESCE((SELECT array_agg(l.language_code ORDER BY l.language_code)
          FROM public.tv_channel_language l WHERE l.channel_id=cc.channel_id),
          ARRAY[]::varchar[]) AS "broadcastLanguages",
        cc.default_variant_id AS "defaultVariantId",
        selected.id AS "variantId", selected.timezone AS "variantTimeZone"
      FROM public.tv_channel_country cc
      JOIN public.tv_channel ch ON ch.id=cc.channel_id
      JOIN public.tv_country tc ON tc.country_id=cc.country_id
      JOIN public.country c ON c.id=tc.country_id
      LEFT JOIN LATERAL (
        SELECT v.id,v.timezone FROM public.tv_variant_country vc
        JOIN public.tv_channel_variant v ON v.id=vc.variant_id
        WHERE vc.channel_country_id=cc.id
        ORDER BY CASE WHEN v.id=cc.default_variant_id THEN 0 ELSE 1 END,
          v.code,v.id LIMIT 1
      ) selected ON TRUE
      WHERE cc.country_id=${country.id}::uuid AND tc.is_active AND c.is_active
        AND cc.is_active AND NOT cc.needs_review
        AND COALESCE(cc.manual_number,cc.official_number,cc.assigned_number) IS NOT NULL
      ORDER BY number,ch.name,cc.id
      LIMIT 10000`;
    return rows.sort(numberSort);
  }
  private async publishedAirings(
    variantIds:readonly string[],countryId:string,from:number,to:number,
  ):Promise<TvAiring[]>{
    if(!variantIds.length)return [];
    // The current pointer is the ONLY authoritative published grid. Query
    // neighboring dates too, because a real airing can cross local midnight.
    const rows=await this.db.prisma.$queryRaw<AiringRow[]>`
      SELECT DISTINCT ON (a.id) a.id,a.source_id AS "sourceId",
        r.variant_id AS "variantId",a.starts_at AS "startsAt",
        a.ends_at AS "endsAt",p.title,p.category,
        CASE WHEN src.synopsis_rights_status='APPROVED'
             AND nullif(btrim(src.synopsis_rights_reference),'') IS NOT NULL
          THEN p.synopsis ELSE NULL END AS description,
        CASE WHEN src.image_rights_status='APPROVED'
             AND nullif(btrim(src.image_rights_reference),'') IS NOT NULL
          THEN p.image_url ELSE NULL END AS "imageUrl"
      FROM public.tv_airing a
      JOIN public.tv_schedule_revision r ON r.id=a.revision_id
      JOIN public.tv_schedule_current cur ON cur.revision_id=r.id
      JOIN public.tv_programme p ON p.id=a.programme_id
      JOIN public.tv_source src ON src.id=a.source_id
      JOIN public.tv_source_country sc ON sc.source_id=src.id
      JOIN public.tv_variant_country vc ON vc.variant_id=r.variant_id
      JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
        AND cc.country_id=sc.country_id
      JOIN public.tv_country tc ON tc.country_id=cc.country_id
      JOIN public.country c ON c.id=tc.country_id
      WHERE r.status='PUBLISHED' AND r.published_at IS NOT NULL
        AND cc.country_id=${countryId}::uuid
        AND r.variant_id::text=ANY(${[...variantIds]}::text[])
        AND a.starts_at < ${new Date(to)}::timestamptz
        AND a.ends_at > ${new Date(from)}::timestamptz
        AND src.is_active AND sc.is_active AND tc.is_active AND c.is_active
        AND cc.is_active AND NOT cc.needs_review
        AND src.programme_rights_status='APPROVED'
        AND nullif(btrim(src.programme_rights_reference),'') IS NOT NULL
      ORDER BY a.id,a.starts_at
      LIMIT 15000`;
    return serializeAirings(rows);
  }
  /** No persisted verified coverage attestation exists in the 19-table candidate.
   * Never derive evidence from missing airings or a successful import run.
   * Future audited attestation store may implement this without changing policy.
   */
  private coverage():CoverageEvidence[]{return [];}
  async schedule(args:{country:string;localDate:string;tab:TvPublicTab;
    page:number;pageSize:number;now?:Date}){
    const country=await this.country(args.country);
    const now=args.now??new Date();
    assertTvDay(args.localDate,country.referenceTimeZone,now);
    if(args.tab==="NOW"&&args.localDate!==todayInZone(now,country.referenceTimeZone))
      throw new RangeError("TV_NOW_ONLY_TODAY");
    const channels=await this.channelRows(country);
    const start=(args.page-1)*args.pageSize;
    const selected=channels.slice(start,start+args.pageSize);
    const localBounds=localDayBounds(args.localDate,country.referenceTimeZone);
    const from=Math.min(localBounds.startMs,now.getTime())-86_400_000;
    const to=Math.max(localBounds.endMs,now.getTime())+86_400_000;
    const all=await this.publishedAirings(selected.flatMap(c=>c.variantId?[c.variantId]:[]),country.id,from,to);
    const items=selected.map(c=>{
      const state=stateForChannel({
        tab:args.tab,localDate:args.localDate,
        timezone:c.variantTimeZone??country.referenceTimeZone,
        variantId:c.variantId,airings:all,coverage:this.coverage(),now,
      });
      return {channel:{id:c.channelId,number:c.number,name:c.name,
          logoUrl:c.logoUrl,broadcastLanguages:c.broadcastLanguages},
        variant:c.variantId?{id:c.variantId,timeZone:c.variantTimeZone}:null,
        ...state,coverageState:"UNKNOWN" as const};
    });
    return {countryIso2:country.isoCode2,
      referenceTimeZone:country.referenceTimeZone,
      localDate:args.localDate,tab:args.tab,sort:"COUNTRY_CHANNEL_NUMBER_ASC",
      items,pagination:{page:args.page,pageSize:args.pageSize,hasNext:start+args.pageSize<channels.length}};
  }
  async channelDetails(channelId:string,iso2:string){
    const country=await this.country(iso2);
    const channel=(await this.channelRows(country)).find(c=>c.channelId===channelId);
    if(!channel)throw new NotFoundException("TV_NOT_FOUND");
    const variants=await this.db.prisma.$queryRaw<VariantRow[]>`
      SELECT v.id,v.code,v.name,v.timezone AS "timeZone"
      FROM public.tv_channel_variant v
      JOIN public.tv_variant_country vc ON vc.variant_id=v.id
      WHERE vc.channel_country_id=${channel.id}::uuid
      ORDER BY CASE WHEN v.id=${channel.defaultVariantId}::uuid THEN 0 ELSE 1 END,v.code,v.id`;
    const languages=await this.db.prisma.$queryRaw<Array<{languageCode:string}>>`
      SELECT language_code AS "languageCode" FROM public.tv_channel_language
      WHERE channel_id=${channelId}::uuid ORDER BY language_code`;
    return {countryIso2:iso2,channel:{id:channelId,name:channel.name,
      number:channel.number,logoUrl:channel.logoUrl,
      broadcastLanguages:languages.map(l=>l.languageCode)},
      variants,defaultVariantId:channel.variantId,
      // Official live link stays hidden until manual rights/content review.
      officialLiveUrl:null};
  }
  async channelAirings(args:{channelId:string;country:string;variantId:string;
    localDate:string;page:number;pageSize:number;now?:Date}){
    const country=await this.country(args.country);
    const channel=(await this.channelRows(country)).find(c=>c.channelId===args.channelId);
    if(!channel)throw new NotFoundException("TV_NOT_FOUND");
    const rows=await this.db.prisma.$queryRaw<Array<{id:string;timeZone:string}>>`
      SELECT v.id,v.timezone AS "timeZone" FROM public.tv_channel_variant v
      JOIN public.tv_variant_country vc ON vc.variant_id=v.id
      WHERE vc.channel_country_id=${channel.id}::uuid AND v.id=${args.variantId}::uuid
      LIMIT 1`;
    const variant=rows[0];
    if(!variant)throw new NotFoundException("TV_NOT_FOUND");
    assertTvDay(args.localDate,variant.timeZone,args.now??new Date());
    const bounds=localDayBounds(args.localDate,variant.timeZone);
    const all=(await this.publishedAirings([variant.id],country.id,bounds.startMs,bounds.endMs))
      .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
    const offset=(args.page-1)*args.pageSize;
    return {channelId:args.channelId,variantId:variant.id,localDate:args.localDate,
      timeZone:variant.timeZone,airings:all.slice(offset,offset+args.pageSize),
      gaps:gapsInDay(all,args.localDate,variant.timeZone),
      coverageState:"UNKNOWN",pagination:{page:args.page,pageSize:args.pageSize,
        hasNext:offset+args.pageSize<all.length}};
  }
  async airingDetails(id:string,now=new Date()){
    await this.requireSchema();
    const rows=await this.db.prisma.$queryRaw<AiringRow[]>`
      SELECT a.id,r.variant_id AS "variantId",a.source_id AS "sourceId",
        a.starts_at AS "startsAt",a.ends_at AS "endsAt",p.title,p.category,
        CASE WHEN src.synopsis_rights_status='APPROVED' AND
          nullif(btrim(src.synopsis_rights_reference),'') IS NOT NULL
          THEN p.synopsis ELSE NULL END AS description,
        CASE WHEN src.image_rights_status='APPROVED' AND
          nullif(btrim(src.image_rights_reference),'') IS NOT NULL
          THEN p.image_url ELSE NULL END AS "imageUrl"
      FROM public.tv_airing a
      JOIN public.tv_schedule_revision r ON r.id=a.revision_id
      JOIN public.tv_schedule_current cur ON cur.revision_id=r.id
      JOIN public.tv_programme p ON p.id=a.programme_id
      JOIN public.tv_source src ON src.id=a.source_id
      JOIN public.tv_source_country sc ON sc.source_id=src.id AND sc.is_active
      JOIN public.tv_variant_country vc ON vc.variant_id=r.variant_id
      JOIN public.tv_channel_country cc ON cc.id=vc.channel_country_id
        AND cc.country_id=sc.country_id
      JOIN public.tv_country tc ON tc.country_id=cc.country_id
      JOIN public.country c ON c.id=tc.country_id
      WHERE a.id=${id}::uuid AND r.status='PUBLISHED' AND r.published_at IS NOT NULL
        AND src.is_active AND tc.is_active AND c.is_active
        AND cc.is_active AND NOT cc.needs_review
        AND src.programme_rights_status='APPROVED'
        AND nullif(btrim(src.programme_rights_reference),'') IS NOT NULL
      LIMIT 1`;
    const air=rows[0];
    if(!air)throw new NotFoundException("TV_NOT_FOUND");
    // A published airing remains authentic; do not substitute a fictional
    // "currently airing" state when its exact start is outside J0..J+6.
    const iso=serializeAirings([air])[0]!;
    if(Date.parse(iso.endsAt)<now.getTime()-7*86_400_000)
      throw new NotFoundException("TV_NOT_FOUND");
    return iso;
  }
  responseLanguages(){return [...TV_LANGUAGES];}
}
