import {
  ConflictException, Injectable, NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { assertIanaZone, assertOfficialUrl,assertTvLogoUrl } from "./tv-catalog-policy";
import {saveUploadedTvIcon,validateUploadedIcon,importTvIconFromUrl} from "./tv-icon-storage";

/** This module intentionally uses bound SQL parameters: TV schema is still a candidate,
 * and must NOT be appended to the canonical Prisma schema before SCRUM-114 approval.
 * All mutations are ADMIN-only and gated in the controller.
 */
@Injectable()
export class TvCatalogService {
  constructor(private readonly database: DatabaseService) {}

  private async requireTvTables(): Promise<void> {
    const rows = await this.database.prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT to_regclass('public.tv_country') IS NOT NULL
         AND to_regclass('public.tv_channel_country') IS NOT NULL
         AND to_regclass('public.tv_variant_country') IS NOT NULL AS present
    `;
    if (rows[0]?.present !== true) {
      throw new ServiceUnavailableException("TV catalogue schema is not installed.");
    }
  }

  async listCountries() {
    await this.requireTvTables();
    return this.database.prisma.$queryRaw`
      SELECT tc.country_id AS "countryId", c.iso_code2 AS "isoCode2",
             tc.is_active AS "isActive", tc.reference_timezone AS "referenceTimezone", tc.updated_at::text AS version,
             count(cc.id)::int AS "channelCount",
             count(cc.id) FILTER (WHERE cc.is_active AND NOT cc.needs_review)::int AS "approvedChannelCount"
      FROM public.tv_country tc
      JOIN public.country c ON c.id=tc.country_id
      LEFT JOIN public.tv_channel_country cc ON cc.country_id=tc.country_id
      GROUP BY tc.country_id,c.iso_code2,tc.is_active,tc.reference_timezone
      ORDER BY c.iso_code2,tc.country_id
    `;
  }

  async upsertCountry(countryId: string, referenceTimezone: string, isActive: boolean, expectedVersion?:string) {
    await this.requireTvTables();
    const zone = assertIanaZone(referenceTimezone);
    const existingCountry = await this.database.prisma.country.findUnique({
      where: { id: countryId }, select: { id: true },
    });
    if (!existingCountry) throw new NotFoundException("Country does not exist");
    const rows = await this.database.prisma.$queryRaw`
      INSERT INTO public.tv_country(country_id,is_active,reference_timezone)
      VALUES (${countryId}::uuid,${isActive},${zone})
      ON CONFLICT(country_id) DO UPDATE SET
        is_active=EXCLUDED.is_active,
        reference_timezone=EXCLUDED.reference_timezone,
        updated_at=now()
      WHERE (${expectedVersion??null}::text IS NULL OR public.tv_country.updated_at::text=${expectedVersion??null})
      RETURNING country_id AS "countryId", is_active AS "isActive",
                reference_timezone AS "referenceTimezone"
    `;
    if(!Array.isArray(rows)||rows.length===0)throw new ConflictException("TV_CONCURRENT_EDIT");
    return rows;
  }

  async listChannels(countryId?: string, search="") {
    await this.requireTvTables();
    const pattern="%"+search.trim().replace(/[\\%_]/g,"\\  async listChannels(countryId?: string) {
    await this.requireTvTables();
    return this.database.prisma.$queryRaw`")+"%";
    return this.database.prisma.$queryRaw`
      SELECT cc.id, cc.country_id AS "countryId",
             cc.channel_id AS "channelId", c.slug, c.name, c.logo_url AS "logoUrl",
             c.website_url AS "websiteUrl", c.x_url AS "xUrl",
             c.facebook_url AS "facebookUrl", c.instagram_url AS "instagramUrl",
             c.youtube_url AS "youtubeUrl", c.official_live_url AS "officialLiveUrl",
             cc.is_active AS "isActive", cc.needs_review AS "needsReview",
             cc.official_number AS "officialNumber", cc.manual_number AS "manualNumber",
             cc.assigned_number AS "assignedNumber",
             COALESCE(cc.manual_number,cc.official_number,cc.assigned_number) AS "effectiveNumber",
             cc.default_variant_id AS "defaultVariantId", cc.updated_at::text AS version
      FROM public.tv_channel_country cc JOIN public.tv_channel c ON c.id=cc.channel_id
      WHERE (${countryId ?? null}::uuid IS NULL OR cc.country_id=${countryId ?? null}::uuid)
        AND c.name ILIKE ${pattern} ESCAPE '\\'
      ORDER BY cc.country_id, COALESCE(cc.manual_number,cc.official_number,cc.assigned_number) NULLS LAST,
               c.name,cc.id
      LIMIT 500
    `;
  }

  /** Load one country/channel association independently of the catalog listing limit. */
  async getChannelAssociation(associationId:string){
    await this.requireTvTables();
    const rows=await this.database.prisma.$queryRaw<Array<Record<string,unknown>>>`
      SELECT cc.id, cc.country_id AS "countryId",
             cc.channel_id AS "channelId", c.slug, c.name, c.logo_url AS "logoUrl",
             c.website_url AS "websiteUrl", c.x_url AS "xUrl",
             c.facebook_url AS "facebookUrl", c.instagram_url AS "instagramUrl",
             c.youtube_url AS "youtubeUrl", c.official_live_url AS "officialLiveUrl",
             cc.is_active AS "isActive", cc.needs_review AS "needsReview",
             cc.official_number AS "officialNumber", cc.manual_number AS "manualNumber",
             cc.assigned_number AS "assignedNumber",
             COALESCE(cc.manual_number,cc.official_number,cc.assigned_number) AS "effectiveNumber",
             cc.default_variant_id AS "defaultVariantId", cc.updated_at::text AS version
      FROM public.tv_channel_country cc
      JOIN public.tv_channel c ON c.id=cc.channel_id
      WHERE cc.id=${associationId}::uuid
    `;
    if(!rows[0])throw new NotFoundException("TV channel association not found");
    return rows[0];
  }

  async discoverChannel(payload: {
    countryId: string; slug: string; name: string; websiteUrl?: string | null | undefined;
    logoUrl?: string | null | undefined;
    xUrl?: string | null | undefined;
    facebookUrl?: string | null | undefined;
    instagramUrl?: string | null | undefined;
    youtubeUrl?: string | null | undefined;
    officialLiveUrl?: string | null | undefined;
  }) {
    await this.requireTvTables();
    const website = assertOfficialUrl(payload.websiteUrl ?? null);
    const logo = assertTvLogoUrl(payload.logoUrl ?? null);
    const x = assertOfficialUrl(payload.xUrl ?? null);
    const facebook = assertOfficialUrl(payload.facebookUrl ?? null);
    const instagram = assertOfficialUrl(payload.instagramUrl ?? null);
    const youtube = assertOfficialUrl(payload.youtubeUrl ?? null);
    const live = assertOfficialUrl(payload.officialLiveUrl ?? null);
    return this.database.prisma.$transaction(async (tx) => {
      // Reuse existing channel on a discovery from another country.
      const channels = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.tv_channel(slug,name,website_url,logo_url,x_url,facebook_url,instagram_url,youtube_url,official_live_url)
        VALUES (${payload.slug},${payload.name},${website},${logo},${x},${facebook},${instagram},${youtube},${live})
        ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug
        RETURNING id
      `;
      const id = channels[0]?.id;
      if (!id) throw new ConflictException("Unable to discover TV channel");
      const countries = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT country_id AS id FROM public.tv_country
        WHERE country_id=${payload.countryId}::uuid
      `;
      if (!countries.length) throw new NotFoundException("TV country must be configured first");
      const links = await tx.$queryRaw`
        INSERT INTO public.tv_channel_country(channel_id,country_id)
        VALUES (${id}::uuid,${payload.countryId}::uuid)
        ON CONFLICT(channel_id,country_id) DO NOTHING
        RETURNING id,channel_id AS "channelId",country_id AS "countryId",
                  is_active AS "isActive",needs_review AS "needsReview"
      `;
      // Imports must NEVER overwrite existing MANUAL fields, status or associations.
      return { channelId: id, discoveredAssociations: links };
    });
  }

  async updateAssociation(id: string, patch: {
    isActive: boolean; needsReview: boolean;
    manualNumber: number | null; officialNumber: number | null;
    assignedNumber: number | null; defaultVariantId: string | null;
    expectedVersion?:string|undefined;
  }) {
    await this.requireTvTables();
    // Unique index and composite default-variant FK are the final arbiter under concurrency.
    try {
      const rows = await this.database.prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE public.tv_channel_country SET
          is_active=${patch.isActive}, needs_review=${patch.needsReview},
          manual_number=${patch.manualNumber},official_number=${patch.officialNumber},
          assigned_number=${patch.assignedNumber},default_variant_id=${patch.defaultVariantId}::uuid,
          updated_at=now()
        WHERE id=${id}::uuid AND (${patch.expectedVersion??null}::text IS NULL OR updated_at::text=${patch.expectedVersion??null})
        RETURNING id
      `;
      if (!rows.length) throw new ConflictException("TV_CONCURRENT_EDIT");
      return rows[0];
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err
        ? String(err.code) : "";
      if (code === "P2010" || code === "23505" || code === "23503" || code === "23514") {
        throw new ConflictException("TV association conflicts with number, variant or active-state constraints.");
      }
      throw err;
    }
  }

  async addVariant(payload: {
    channelId: string; channelCountryId: string;
    code: string; name: string; timezone: string;
  }) {
    await this.requireTvTables();
    const zone = assertIanaZone(payload.timezone);
    return this.database.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.tv_channel_variant(channel_id,code,name,timezone)
        VALUES (${payload.channelId}::uuid,${payload.code},${payload.name},${zone})
        ON CONFLICT(channel_id,code) DO UPDATE SET name=EXCLUDED.name
        RETURNING id
      `;
      const variantId = rows[0]?.id;
      if (!variantId) throw new ConflictException("Variant could not be created");
      await tx.$executeRaw`
        INSERT INTO public.tv_variant_country(variant_id,channel_country_id,channel_id)
        VALUES (${variantId}::uuid,${payload.channelCountryId}::uuid,${payload.channelId}::uuid)
        ON CONFLICT(variant_id,channel_country_id) DO NOTHING
      `;
      // The first verified variant becomes the default for its country.
      // Preserve any explicit existing administrator choice.
      await tx.$executeRaw`
        UPDATE public.tv_channel_country
        SET default_variant_id=${variantId}::uuid,updated_at=now()
        WHERE id=${payload.channelCountryId}::uuid
          AND channel_id=${payload.channelId}::uuid AND default_variant_id IS NULL
      `;
      return { variantId };
    });
  }

  /** Deterministic smallest available number. Transactions serialize automatic
   * allocations; the unique expression index still protects manual races.
   */
  async assignNextFreeNumber(associationId: string) {
    await this.requireTvTables();
    try {
      return await this.database.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(241024, 198)`;
        const associations = await tx.$queryRaw<Array<{
          id: string; countryId: string; effectiveNumber: number | null;
        }>>`
          SELECT id, country_id AS "countryId",
                 COALESCE(manual_number,official_number,assigned_number) AS "effectiveNumber"
          FROM public.tv_channel_country WHERE id=${associationId}::uuid FOR UPDATE
        `;
        const association = associations[0];
        if (!association) throw new NotFoundException("TV association not found");
        if (association.effectiveNumber !== null) return {
          id: association.id, effectiveNumber: association.effectiveNumber, unchanged: true,
        };
        const numbers = await tx.$queryRaw<Array<{ n: number }>>`
          SELECT candidate.n FROM generate_series(1, 10000) AS candidate(n)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.tv_channel_country cc
            WHERE cc.country_id=${association.countryId}::uuid
              AND COALESCE(cc.manual_number,cc.official_number,cc.assigned_number)=candidate.n
          )
          ORDER BY candidate.n LIMIT 1
        `;
        const number = numbers[0]?.n;
        if (number === undefined) throw new ConflictException("No national TV channel number available");
        await tx.$executeRaw`
          UPDATE public.tv_channel_country SET assigned_number=${number},updated_at=now()
          WHERE id=${associationId}::uuid
        `;
        return { id: associationId, effectiveNumber: number, unchanged: false };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw new ConflictException("Channel number assignment conflicted; retry");
    }
  }

  async uploadChannelIcon(channelId:string,base64:string){
    await this.requireTvTables();
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      SELECT id FROM public.tv_channel WHERE id=${channelId}::uuid
    `;
    if(!rows.length)throw new NotFoundException("TV channel not found");
    const bytes=validateUploadedIcon(base64);
    const url=await saveUploadedTvIcon(channelId,bytes);
    await this.database.prisma.$executeRaw`
      UPDATE public.tv_channel SET logo_url=${url} WHERE id=${channelId}::uuid
    `;
    return {logoUrl:url};
  }

  async importChannelIcon(channelId:string,remoteUrl:string){
    await this.requireTvTables();
    const rows=await this.database.prisma.$queryRaw<Array<{id:string}>>`
      SELECT id FROM public.tv_channel WHERE id=${channelId}::uuid
    `;
    if(!rows.length)throw new NotFoundException("TV channel not found");
    const logoUrl=await importTvIconFromUrl(remoteUrl);
    await this.database.prisma.$executeRaw`
      UPDATE public.tv_channel SET logo_url=${logoUrl} WHERE id=${channelId}::uuid
    `;
    return {logoUrl};
  }

  async updateChannelProfile(id: string, profile: {
    name: string; logoUrl: string | null; websiteUrl: string | null;
    xUrl: string | null; facebookUrl: string | null;
    instagramUrl: string | null; youtubeUrl: string | null;
    officialLiveUrl: string | null;
  }) {
    await this.requireTvTables();
    // Empty string explicitly means the administrator removed the logo.
    // Unlike NULL (unknown/unset), it must not be repopulated by EPG imports.
    const logo = profile.logoUrl===""?"":assertTvLogoUrl(profile.logoUrl);
    const site = assertOfficialUrl(profile.websiteUrl);
    const x = assertOfficialUrl(profile.xUrl);
    const facebook = assertOfficialUrl(profile.facebookUrl);
    const instagram = assertOfficialUrl(profile.instagramUrl);
    const youtube = assertOfficialUrl(profile.youtubeUrl);
    const live = assertOfficialUrl(profile.officialLiveUrl);
    const rows = await this.database.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE public.tv_channel SET name=${profile.name},
        logo_url=${logo}, website_url=${site}, x_url=${x},
        facebook_url=${facebook},instagram_url=${instagram},
        youtube_url=${youtube},official_live_url=${live},updated_at=now()
      WHERE id=${id}::uuid RETURNING id
    `;
    if (!rows.length) throw new NotFoundException("TV channel not found");
    return rows[0];
  }

  async replaceBroadcastLanguages(channelId: string, languages: string[]) {
    await this.requireTvTables();
    const unique = [...new Set(languages.map((s) => s.trim().toLowerCase()))];
    return this.database.prisma.$transaction(async (tx) => {
      const channels = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.tv_channel WHERE id=${channelId}::uuid FOR UPDATE
      `;
      if (!channels.length) throw new NotFoundException("TV channel not found");
      await tx.$executeRaw`
        DELETE FROM public.tv_channel_language WHERE channel_id=${channelId}::uuid
      `;
      for (const language of unique) {
        await tx.$executeRaw`
          INSERT INTO public.tv_channel_language(channel_id,language_code)
          VALUES(${channelId}::uuid,${language})
        `;
      }
      return { channelId, languages: unique };
    });
  }

}
