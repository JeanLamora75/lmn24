import {
  ConflictException, Injectable, NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {downloadEpgSource} from "./tv-epg-download";
import {decodeEpgBuffer} from "./tv-epg-decoder";
import {classifyEpgFailure} from "./tv-epg-failure";
import {
  assertMappingReview, assertPriorityUniqueness, validateEpgSourceUrl,
  type RightsDecision, type RightsFamily, type EpgFormat, type SourcePriority,
  type ExternalMapping,
} from "./tv-epg-source-policy";

export type SourceRightsInput = Record<RightsFamily, RightsDecision>;
export type SourceInput = {
  name:string; sourceUrl:string; format:EpgFormat; isActive:boolean;
  geographicScope:"GLOBAL"|"COUNTRY";scopeCountryId:string|null;
  rights:SourceRightsInput;
};

@Injectable()
export class TvEpgSourcesService {
  constructor(private readonly database:DatabaseService){}

  private async requireSchema():Promise<void> {
    const rows=await this.database.prisma.$queryRaw<Array<{present:boolean}>>`
      SELECT to_regclass('public.tv_source') IS NOT NULL
        AND to_regclass('public.tv_source_country') IS NOT NULL
        AND to_regclass('public.tv_channel_external_id') IS NOT NULL AS present
    `;
    if(!rows[0]?.present) throw new ServiceUnavailableException("EPG catalogue not installed");
  }

  /** Explicit admin-only connectivity diagnostic for an existing source.
   * It performs a real bounded fetch and decode but never writes TV data.
   * Only allowlisted error codes and counts are returned, never remote content.
   */
  async testConnection(sourceId:string){
    await this.requireSchema();
    const rows=await this.database.prisma.$queryRaw<Array<{
      sourceUrl:string;format:EpgFormat;
    }>>`
      SELECT source_url AS "sourceUrl",format
      FROM public.tv_source WHERE id=${sourceId}::uuid LIMIT 1
    `;
    const source=rows[0];
    if(!source)throw new NotFoundException("EPG source not found");
    const started=Date.now();
    let bytes=0;
    try{
      const data=await downloadEpgSource(source.sourceUrl,source.format);
      bytes=data.byteLength;
      try{
        const decoded=await decodeEpgBuffer(data,source.format);
        return {ok:true,stage:"COMPLETE" as const,code:null,
          bytes,programmes:decoded.programmes.length,
          skippedInvalidDuration:decoded.skippedInvalidDuration??0,
          channels:new Set(decoded.programmes.map(p=>p.externalChannelId)).size,
          elapsedMs:Date.now()-started};
      }catch(error){
        return {ok:false,stage:"DECODE" as const,
          code:classifyEpgFailure(error,"DECODE"),bytes,
          programmes:null,channels:null,elapsedMs:Date.now()-started};
      }
    }catch(error){
      const code=classifyEpgFailure(error,"DOWNLOAD");
      // The transport also performs decompression and guarded content
      // validation: report the actual phase, not always "DOWNLOAD".
      const stage=code==="EPG_GZIP_INVALID"||code==="EPG_GZIP_PROCESS_FAILED"
        ||code==="EPG_SIZE_EXPANDED"?"DECOMPRESS"
        :code==="EPG_XML_SECURITY_REJECTED"||code==="EPG_FORMAT_MISMATCH"
          ||code==="EPG_JSON_INVALID"?"VALIDATE":"DOWNLOAD";
      return {ok:false,stage,code,bytes:null,
        programmes:null,channels:null,elapsedMs:Date.now()-started};
    }
  }

  async listSources(countryId?:string) {
    await this.requireSchema();
    return this.database.prisma.$queryRaw`
      SELECT s.id,s.name,s.source_url AS "sourceUrl",s.format,s.is_active AS "isActive",
        s.geographic_scope AS "geographicScope",
        s.scope_country_id AS "scopeCountryId",
        md5(to_jsonb(s)::text) AS version,
        s.programme_rights_status AS "programmeRightsStatus",
        s.synopsis_rights_status AS "synopsisRightsStatus",
        s.image_rights_status AS "imageRightsStatus",
        s.logo_rights_status AS "logoRightsStatus",
        s.programme_rights_reference AS "programmeRightsReference",
        s.synopsis_rights_reference AS "synopsisRightsReference",
        s.image_rights_reference AS "imageRightsReference",
        s.logo_rights_reference AS "logoRightsReference",
        sc.country_id AS "countryId",sc.is_active AS "countrySourceActive",
        sc.priority,lr.finished_at AS "lastImportFinishedAt",
        lr.status AS "lastImportStatus"
      FROM public.tv_source s
      LEFT JOIN public.tv_source_country sc ON sc.source_id=s.id
      LEFT JOIN LATERAL (
        SELECT r.finished_at,r.status FROM public.tv_import_scope scope
        JOIN public.tv_import_run r ON r.id=scope.run_id
        WHERE scope.source_id=s.id
          AND (sc.country_id IS NULL OR scope.country_id=sc.country_id)
        ORDER BY r.created_at DESC LIMIT 1
      ) lr ON TRUE
      WHERE (${countryId??null}::uuid IS NULL OR sc.country_id=${countryId??null}::uuid)
      ORDER BY sc.country_id NULLS LAST,sc.priority NULLS LAST,s.name,s.id
      LIMIT 500
    `;
  }

  async createSource(input:SourceInput) {
    await this.requireSchema();
    const url=validateEpgSourceUrl(input.sourceUrl).toString();
    const r=input.rights;
    const rows=await this.database.prisma.$queryRaw`
      INSERT INTO public.tv_source
      (name,source_url,format,is_active,geographic_scope,scope_country_id,rights_status,
       programme_rights_status,programme_rights_reference,
       synopsis_rights_status,synopsis_rights_reference,
       image_rights_status,image_rights_reference,
       logo_rights_status,logo_rights_reference)
      VALUES (${input.name},${url},${input.format},${input.isActive},
        ${input.geographicScope},${input.scopeCountryId}::uuid,'UNREVIEWED',
        ${r.programme.status},${r.programme.reference},
        ${r.synopsis.status},${r.synopsis.reference},
        ${r.image.status},${r.image.reference},
        ${r.logo.status},${r.logo.reference})
      RETURNING id,name,format,is_active AS "isActive"
    `;
    return rows;
  }

  async updateSourceConfiguration(sourceId:string,input:{
    name:string;sourceUrl:string;format:EpgFormat;isActive:boolean;
    geographicScope:"GLOBAL"|"COUNTRY";scopeCountryId:string|null;
    expectedVersion?:string|undefined;
  }) {
    await this.requireSchema();
    const url=validateEpgSourceUrl(input.sourceUrl).toString();
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      UPDATE public.tv_source AS s
      SET name=${input.name},source_url=${url},format=${input.format},is_active=${input.isActive},
        geographic_scope=${input.geographicScope},scope_country_id=${input.scopeCountryId}::uuid
      WHERE id=${sourceId}::uuid AND (${input.expectedVersion??null}::text IS NULL
        OR md5(to_jsonb(s)::text)=${input.expectedVersion??null}) RETURNING id
    `;
    if(!rows.length)throw new ConflictException("TV_CONCURRENT_EDIT");
    return rows[0];
  }

  /** Discovered identifiers are not catalogue channels until reviewed and
   * assigned to a country. Surface the inbox without assuming global feeds
   * belong to the country of a particular import run.
   */
  async listPendingDiscoveries(limit:number,offset:number,search:string,countryId:string|null){
    await this.requireSchema();
    const term=search.trim().slice(0,120);
    // Null denotes UNCLASSIFIED. A selected country is a REAL filter over
    // existing geographical associations, never a bulk assignment target.
    const total=await this.database.prisma.$queryRaw<Array<{count:number}>>`
      SELECT count(*)::int AS count FROM public.tv_channel_external_id m
      JOIN public.tv_source s ON s.id=m.source_id
      WHERE m.mapping_status='PENDING_REVIEW'
        AND (${term}='' OR m.external_id ILIKE '%' || ${term} || '%'
          OR s.name ILIKE '%' || ${term} || '%')
        AND (
          (${countryId}::uuid IS NULL AND NOT EXISTS(
            SELECT 1 FROM public.tv_channel_country cc
            WHERE cc.channel_id=m.channel_id))
          OR (${countryId}::uuid IS NOT NULL AND EXISTS(
            SELECT 1 FROM public.tv_channel_country cc
            WHERE cc.channel_id=m.channel_id AND cc.country_id=${countryId}::uuid))
        )
    `;
    const items=await this.database.prisma.$queryRaw<Array<{
      id:string;externalId:string;sourceId:string;sourceName:string;
      channelId:string|null;channelName:string|null;
    }>>`
      SELECT m.id,m.external_id AS "externalId",
        m.source_id AS "sourceId",s.name AS "sourceName",
        m.channel_id AS "channelId",c.name AS "channelName"
      FROM public.tv_channel_external_id m
      JOIN public.tv_source s ON s.id=m.source_id
      LEFT JOIN public.tv_channel c ON c.id=m.channel_id
      WHERE m.mapping_status='PENDING_REVIEW'
        AND (${term}='' OR m.external_id ILIKE '%' || ${term} || '%'
          OR s.name ILIKE '%' || ${term} || '%')
        AND (
          (${countryId}::uuid IS NULL AND NOT EXISTS(
            SELECT 1 FROM public.tv_channel_country cc
            WHERE cc.channel_id=m.channel_id))
          OR (${countryId}::uuid IS NOT NULL AND EXISTS(
            SELECT 1 FROM public.tv_channel_country cc
            WHERE cc.channel_id=m.channel_id AND cc.country_id=${countryId}::uuid))
        )
      ORDER BY s.name,m.external_id,m.id
      LIMIT ${limit} OFFSET ${offset}
    `;
    return {total:total[0]?.count??0,items};
  }

  /** Explicitly import selected discovered identifiers into one country.
   * Creates inactive, review-required catalogue entries and an IANA variant;
   * never assigns numbers, verifies mappings or publishes TV programmes.
   * The administrator chooses a country because global feeds cannot be
   * automatically and safely classified geographically.
   */
  async importDiscoveredChannels(countryId:string,mappingIds:string[]){
    await this.requireSchema();
    return this.database.prisma.$transaction(async tx=>{
      const countries=await tx.$queryRaw<Array<{timezone:string}>>`
        SELECT reference_timezone AS timezone FROM public.tv_country
        WHERE country_id=${countryId}::uuid LIMIT 1
      `;
      const timezone=countries[0]?.timezone;
      if(!timezone)throw new NotFoundException("TV country not configured");
      let created=0,existing=0;
      for(const mappingId of mappingIds){
        const rows=await tx.$queryRaw<Array<{
          externalId:string;channelId:string|null;status:string;
        }>>`
          SELECT external_id AS "externalId",channel_id AS "channelId",
            mapping_status AS status
          FROM public.tv_channel_external_id
          WHERE id=${mappingId}::uuid FOR UPDATE
        `;
        const mapping=rows[0];
        if(!mapping||mapping.status!=="PENDING_REVIEW")
          throw new ConflictException("EPG_MAPPING_NOT_PENDING");
        const name=mapping.externalId.trim().slice(0,255)||"Chaîne EPG à identifier";
        const slug="epg-"+mappingId.replaceAll("-","").toLowerCase();
        const channel=mapping.channelId?[{id:mapping.channelId}]:
          await tx.$queryRaw<Array<{id:string}>>`
            INSERT INTO public.tv_channel(slug,name)
            VALUES(${slug},${name})
            ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug
            RETURNING id
          `;
        const channelId=channel[0]?.id;
        if(!channelId)throw new ConflictException("TV_CHANNEL_CREATION_FAILED");
        const links=await tx.$queryRaw<Array<{id:string}>>`
          INSERT INTO public.tv_channel_country(channel_id,country_id,
            is_active,needs_review)
          VALUES(${channelId}::uuid,${countryId}::uuid,FALSE,TRUE)
          ON CONFLICT(channel_id,country_id) DO UPDATE
            SET channel_id=EXCLUDED.channel_id
          RETURNING id
        `;
        const associationId=links[0]?.id;
        if(!associationId)throw new ConflictException("TV_COUNTRY_LINK_FAILED");
        const variants=await tx.$queryRaw<Array<{id:string}>>`
          INSERT INTO public.tv_channel_variant(channel_id,code,name,timezone)
          VALUES(${channelId}::uuid,'epg-main',${name},${timezone})
          ON CONFLICT(channel_id,code) DO UPDATE SET code=EXCLUDED.code
          RETURNING id
        `;
        const variantId=variants[0]?.id;
        if(!variantId)throw new ConflictException("TV_VARIANT_CREATION_FAILED");
        await tx.$executeRaw`
          INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id)
          VALUES(${variantId}::uuid,${associationId}::uuid,${channelId}::uuid)
          ON CONFLICT(variant_id,channel_country_id) DO NOTHING
        `;
        await tx.$executeRaw`
          UPDATE public.tv_channel_country
          SET default_variant_id=${variantId}::uuid
          WHERE id=${associationId}::uuid AND default_variant_id IS NULL
        `;
        // Reserve the channel for manual review without marking it VERIFIED.
        await tx.$executeRaw`
          UPDATE public.tv_channel_external_id
          SET channel_id=${channelId}::uuid
          WHERE id=${mappingId}::uuid AND mapping_status='PENDING_REVIEW'
        `;
        if(mapping.channelId)existing++;else created++;
      }
      return {created,existing,requiresReview:true,published:0};
    });
  }

  async listMappings(sourceId:string,search=""){
    await this.requireSchema();
    const term=search.trim().slice(0,120);
    return this.database.prisma.$queryRaw`
      SELECT m.id,m.source_id AS "sourceId",m.external_id AS "externalId",
        m.mapping_status AS "status",m.channel_id AS "channelId",
        m.variant_id AS "variantId",c.name AS "channelName"
      FROM public.tv_channel_external_id m
      LEFT JOIN public.tv_channel c ON c.id=m.channel_id
      WHERE m.source_id=${sourceId}::uuid
        AND (${term}='' OR m.external_id ILIKE '%' || ${term} || '%')
      ORDER BY m.mapping_status,m.external_id,m.id LIMIT 1000
    `;
  }

  async setRights(sourceId:string, rights:SourceRightsInput, expectedVersion?:string) {
    await this.requireSchema();
    const r=rights;
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      UPDATE public.tv_source AS s SET
        programme_rights_status=${r.programme.status},programme_rights_reference=${r.programme.reference},
        synopsis_rights_status=${r.synopsis.status},synopsis_rights_reference=${r.synopsis.reference},
        image_rights_status=${r.image.status},image_rights_reference=${r.image.reference},
        logo_rights_status=${r.logo.status},logo_rights_reference=${r.logo.reference}
      WHERE id=${sourceId}::uuid AND (${expectedVersion??null}::text IS NULL
        OR md5(to_jsonb(s)::text)=${expectedVersion??null}) RETURNING id
    `;
    if(!rows.length)throw new ConflictException("TV_CONCURRENT_EDIT");
    return rows[0];
  }

  /** Complete per-country ordering, including globally enabled sources without
   * an existing country-specific override. Never silently omit global sources.
   */
  async listCountryPriorities(countryId:string){
    await this.requireSchema();
    const country=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      SELECT country_id AS id FROM public.tv_country
      WHERE country_id=${countryId}::uuid LIMIT 1
    `;
    if(!country.length)throw new NotFoundException("TV country not found");
    const items=await this.database.prisma.$queryRaw<Array<{
      sourceId:string;name:string;isActive:boolean;
      countrySourceActive:boolean;priority:number|null;
    }>>`
      SELECT s.id AS "sourceId",s.name,s.is_active AS "isActive",
        COALESCE(sc.is_active,TRUE) AS "countrySourceActive",
        sc.priority
      FROM public.tv_source s
      LEFT JOIN public.tv_source_country sc
        ON sc.source_id=s.id AND sc.country_id=${countryId}::uuid
      WHERE s.geographic_scope='GLOBAL' OR s.scope_country_id=${countryId}::uuid
      ORDER BY sc.priority NULLS LAST,s.name,s.id
      LIMIT 500
    `;
    return {countryId,items};
  }

  /** Locks a whole country to update all priorities in one transaction. */
  async replaceCountryPriorities(countryId:string, entries:readonly SourcePriority[]) {
    await this.requireSchema();
    if(entries.some(e=>e.countryId!==countryId)) throw new ConflictException("Country mismatch");
    if(new Set(entries.map(e=>e.sourceId)).size!==entries.length)throw new ConflictException("Repeated source");
    assertPriorityUniqueness(entries);
    return this.database.prisma.$transaction(async tx=>{
      const countries=await tx.$queryRaw<Array<{id:string}>>`
        SELECT country_id AS id FROM public.tv_country WHERE country_id=${countryId}::uuid FOR UPDATE
      `;
      if(!countries.length) throw new NotFoundException("TV country not found");
      // Reprioritization must cover the complete country assignment set.
      // This avoids leaving omitted sources with unbounded temporary priorities.
      const assigned=await tx.$queryRaw<Array<{sourceId:string}>>`
        SELECT source_id AS "sourceId" FROM public.tv_source_country
        WHERE country_id=${countryId}::uuid FOR UPDATE
      `;
      const requested=new Set(entries.map(e=>e.sourceId));
      if(assigned.some(e=>!requested.has(e.sourceId))) {
        throw new ConflictException("Include all existing country sources when reprioritizing");
      }
      // Move existing priorities out of the target range atomically.
      await tx.$executeRaw`
        UPDATE public.tv_source_country SET priority=priority+200000
        WHERE country_id=${countryId}::uuid
      `;
      for(const e of entries) {
        await tx.$executeRaw`
          INSERT INTO public.tv_source_country(source_id,country_id,priority,is_active)
          VALUES (${e.sourceId}::uuid,${countryId}::uuid,${e.priority},${e.isActive})
          ON CONFLICT(source_id,country_id) DO UPDATE SET
            priority=EXCLUDED.priority,is_active=EXCLUDED.is_active
        `;
      }
      return {countryId,updated:entries.length};
    });
  }

  async proposeExternalId(sourceId:string,externalId:string) {
    await this.requireSchema();
    const rows=await this.database.prisma.$queryRaw`
      INSERT INTO public.tv_channel_external_id(source_id,external_id,mapping_status)
      VALUES (${sourceId}::uuid,${externalId},'PENDING_REVIEW')
      ON CONFLICT(source_id,external_id) DO NOTHING
      RETURNING id, mapping_status AS "status"
    `;
    return rows;
  }

  async reviewExternalId(id:string,mapping:ExternalMapping) {
    await this.requireSchema();
    assertMappingReview(mapping);
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      UPDATE public.tv_channel_external_id
      SET channel_id=${mapping.channelId}::uuid,
          variant_id=${mapping.variantId}::uuid,
          mapping_status=${mapping.status}
      WHERE id=${id}::uuid AND source_id=${mapping.sourceId}::uuid
        AND external_id=${mapping.externalId}
      RETURNING id
    `;
    if(!rows.length)throw new NotFoundException("EPG mapping not found");
    return rows[0];
  }
}
