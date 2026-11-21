import {
  ConflictException, Injectable, NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {
  assertMappingReview, assertPriorityUniqueness, validateEpgSourceUrl,
  type RightsDecision, type RightsFamily, type EpgFormat, type SourcePriority,
  type ExternalMapping,
} from "./tv-epg-source-policy";

export type SourceRightsInput = Record<RightsFamily, RightsDecision>;
export type SourceInput = {
  name:string; sourceUrl:string; format:EpgFormat; isActive:boolean;
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

  async listSources(countryId?:string) {
    await this.requireSchema();
    return this.database.prisma.$queryRaw`
      SELECT s.id,s.name,s.source_url AS "sourceUrl",s.format,s.is_active AS "isActive",
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
    for(const family of ["programme","synopsis","image","logo"] as const) {
      if(r[family].status==="APPROVED"&&!r[family].reference?.trim())
        throw new ConflictException("Approved rights require evidence per content family");
    }
    const rows=await this.database.prisma.$queryRaw`
      INSERT INTO public.tv_source
      (name,source_url,format,is_active,rights_status,
       programme_rights_status,programme_rights_reference,
       synopsis_rights_status,synopsis_rights_reference,
       image_rights_status,image_rights_reference,
       logo_rights_status,logo_rights_reference)
      VALUES (${input.name},${url},${input.format},${input.isActive},'UNREVIEWED',
        ${r.programme.status},${r.programme.reference},
        ${r.synopsis.status},${r.synopsis.reference},
        ${r.image.status},${r.image.reference},
        ${r.logo.status},${r.logo.reference})
      RETURNING id,name,format,is_active AS "isActive"
    `;
    return rows;
  }

  async updateSourceConfiguration(sourceId:string,input:{
    name:string;sourceUrl:string;format:EpgFormat;isActive:boolean;expectedVersion?:string|undefined;
  }) {
    await this.requireSchema();
    const url=validateEpgSourceUrl(input.sourceUrl).toString();
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      UPDATE public.tv_source
      SET name=${input.name},source_url=${url},format=${input.format},is_active=${input.isActive}
      WHERE id=${sourceId}::uuid AND (${input.expectedVersion??null}::text IS NULL
        OR md5(to_jsonb(public.tv_source)::text)=${input.expectedVersion??null}) RETURNING id
    `;
    if(!rows.length)throw new ConflictException("TV_CONCURRENT_EDIT");
    return rows[0];
  }

  async listMappings(sourceId:string){
    await this.requireSchema();
    return this.database.prisma.$queryRaw`
      SELECT m.id,m.source_id AS "sourceId",m.external_id AS "externalId",
        m.mapping_status AS "status",m.channel_id AS "channelId",
        m.variant_id AS "variantId",c.name AS "channelName"
      FROM public.tv_channel_external_id m
      LEFT JOIN public.tv_channel c ON c.id=m.channel_id
      WHERE m.source_id=${sourceId}::uuid
      ORDER BY m.mapping_status,m.external_id,m.id LIMIT 1000
    `;
  }

  async setRights(sourceId:string, rights:SourceRightsInput, expectedVersion?:string) {
    await this.requireSchema();
    for(const family of ["programme","synopsis","image","logo"] as const) {
      if(rights[family].status==="APPROVED"&&!rights[family].reference?.trim())
        throw new ConflictException("Approved rights require evidence");
    }
    const r=rights;
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      UPDATE public.tv_source SET
        programme_rights_status=${r.programme.status},programme_rights_reference=${r.programme.reference},
        synopsis_rights_status=${r.synopsis.status},synopsis_rights_reference=${r.synopsis.reference},
        image_rights_status=${r.image.status},image_rights_reference=${r.image.reference},
        logo_rights_status=${r.logo.status},logo_rights_reference=${r.logo.reference}
      WHERE id=${sourceId}::uuid AND (${expectedVersion??null}::text IS NULL
        OR md5(to_jsonb(public.tv_source)::text)=${expectedVersion??null}) RETURNING id
    `;
    if(!rows.length)throw new ConflictException("TV_CONCURRENT_EDIT");
    return rows[0];
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
