import {ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

export const TV_DESCRIPTION_LANGUAGES=["fr","en","de","es","pt","it","ru","nl"] as const;
@Injectable()
export class TvTranslationAdminService{
 constructor(private readonly database:DatabaseService){}
 private async ready():Promise<void>{
  const rows=await this.database.prisma.$queryRaw<Array<{ready:boolean}>>`
   SELECT to_regclass('public.tv_translation_provider') IS NOT NULL
     AND to_regclass('public.tv_channel_description') IS NOT NULL AS ready`;
  if(!rows[0]?.ready)throw new ServiceUnavailableException("TV translation schema is not installed");
 }
 async providers(){
  await this.ready();
  // Never return credential_reference, contact_email or API secrets to browser.
  return {items:await this.database.prisma.$queryRaw`
   SELECT id,provider_type AS "providerType",is_active AS "isActive",
    is_selected AS "isSelected",
    free_approved_at IS NOT NULL AS "freeApproved",
    rights_reviewed_at IS NOT NULL AS "rightsReviewed"
   FROM public.tv_translation_provider ORDER BY provider_type,id`};
 }
 async selectProvider(id:string){
  await this.ready();
  return this.database.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(241024,122)`;
   const rows=await tx.$queryRaw<Array<{id:string;isActive:boolean;freeApproved:boolean;rightsReviewed:boolean}>>`
    SELECT id,is_active AS "isActive",free_approved_at IS NOT NULL AS "freeApproved",
      rights_reviewed_at IS NOT NULL AS "rightsReviewed"
    FROM public.tv_translation_provider WHERE id=${id}::uuid FOR UPDATE`;
   const provider=rows[0];
   if(!provider)throw new NotFoundException("TV provider not found");
   if(!provider.isActive||!provider.freeApproved||!provider.rightsReviewed)
    throw new ConflictException("TV_PROVIDER_NOT_APPROVED");
   await tx.$executeRaw`UPDATE public.tv_translation_provider SET is_selected=FALSE WHERE is_selected`;
   await tx.$executeRaw`UPDATE public.tv_translation_provider SET is_selected=TRUE WHERE id=${id}::uuid`;
   return {id,selected:true};
  });
 }
 async descriptions(channelId:string){
  await this.ready();
  const channel=await this.database.prisma.$queryRaw<Array<{id:string}>>`
   SELECT id FROM public.tv_channel WHERE id=${channelId}::uuid`;
  if(!channel.length)throw new NotFoundException("TV channel not found");
  const items=await this.database.prisma.$queryRaw<Array<{
   languageCode:string;content:string;origin:string;version:string;
  }>>`
   SELECT language_code AS "languageCode",content,origin,
     updated_at::text AS version
   FROM public.tv_channel_description WHERE channel_id=${channelId}::uuid
   ORDER BY language_code`;
  return {channelId,items};
 }
 async setManualDescription(channelId:string,lang:string,content:string,expectedVersion:string|null){
  await this.ready();
  const channels=await this.database.prisma.$queryRaw<Array<{id:string}>>`
   SELECT id FROM public.tv_channel WHERE id=${channelId}::uuid`;
  if(!channels.length)throw new NotFoundException("TV channel not found");
  // Concurrent changes never overwrite a newer translated or MANUAL value.
  const saved=await this.database.prisma.$queryRaw<Array<{version:string}>>`
   INSERT INTO public.tv_channel_description(channel_id,language_code,content,origin)
   VALUES(${channelId}::uuid,${lang},${content},'MANUAL')
   ON CONFLICT(channel_id,language_code) DO UPDATE
   SET content=EXCLUDED.content,origin='MANUAL',provider_id=NULL,updated_at=now()
   WHERE public.tv_channel_description.updated_at::text=${expectedVersion}::text
   RETURNING updated_at::text AS version`;
  if(!saved[0])throw new ConflictException("TV_CONCURRENT_EDIT");
  return {channelId,languageCode:lang,origin:"MANUAL",version:saved[0].version};
 }
}
