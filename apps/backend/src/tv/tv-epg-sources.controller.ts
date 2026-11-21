import {
 BadRequestException,Body,Controller,ForbiddenException,Get,Header,Param,Patch,Post,
 Put,Query,Req,ServiceUnavailableException,UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { TvEpgSourcesService } from "./tv-epg-sources.service";

const uuid=z.string().uuid();
const rightsStatus=z.enum(["UNREVIEWED","APPROVED","REJECTED","EXPIRED"]);
// Review status may be recorded without attaching a document. Publication remains
// gated separately by a qualified non-empty reference and explicit public GO.
const right=z.object({status:rightsStatus,reference:z.string().max(2048).nullable()}).strict();
const rights=z.object({programme:right,synopsis:right,image:right,logo:right}).strict();
const source=z.object({
 name:z.string().trim().min(1).max(255),
 sourceUrl:z.string().max(2048),format:z.enum(["XMLTV","XMLTV_GZIP","JSON"]),
 isActive:z.boolean(),rights,
}).strict();
const sourceConfiguration=source.omit({rights:true}).extend({expectedVersion:z.string().min(1).max(100).optional()});
const rightsUpdate=rights.extend({expectedVersion:z.string().min(1).max(100).optional()});

const priorities=z.object({items:z.array(z.object({
 sourceId:uuid,countryId:uuid,priority:z.number().int().min(1).max(100000),
 isActive:z.boolean(),
}).strict()).max(1000)}).strict();
const mapping=z.object({
 sourceId:uuid,externalId:z.string().trim().min(1).max(1000),
 channelId:uuid.nullable(),variantId:uuid.nullable(),
 status:z.enum(["PENDING_REVIEW","VERIFIED","REJECTED"]),
}).strict();

type ReqLike={headers:Record<string,string|string[]|undefined>};

@ApiExcludeController()
@Controller("admin/tv/epg-sources")
export class TvEpgSourcesController {
 private readonly cookieName:string;
 constructor(private readonly auth:AuthService,
  private readonly service:TvEpgSourcesService,
  private readonly config:ConfigService){
   this.cookieName=config.get<string>("SESSION_COOKIE_NAME")?.trim()||DEFAULT_SESSION_COOKIE_NAME;
 }
 private async assertAdmin(req:ReqLike):Promise<void>{
   const cookie=Array.isArray(req.headers.cookie)?req.headers.cookie.join(";"):req.headers.cookie;
   const token=cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith(this.cookieName+"="))
     ?.slice(this.cookieName.length+1);
   const user=await this.auth.getUserFromSession(token);
   if(!user)throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
   if(user.role!=="ADMIN")throw new ForbiddenException("Administrator permission required");
   if(this.config.get<string>("TV_CATALOG_ADMIN_ENABLED")!=="true")
     throw new ServiceUnavailableException("TV EPG source administration is not enabled");
 }
 @Get()
 @Header("Cache-Control","no-store")
 async list(@Req() request:ReqLike,@Query("countryId") countryId?:string){
   await this.assertAdmin(request);
   if(countryId&&!uuid.safeParse(countryId).success)throw new BadRequestException("Invalid country");
   return {items:await this.service.listSources(countryId)};
 }
 @Post()
 @Header("Cache-Control","no-store")
 async create(@Req() request:ReqLike,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=source.safeParse(body);
   if(!parsed.success)throw new BadRequestException("Invalid EPG source");
   return this.service.createSource(parsed.data);
 }
 @Patch(":id/configuration")
 @Header("Cache-Control","no-store")
 async updateSourceConfiguration(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=sourceConfiguration.safeParse(body);
   if(!uuid.safeParse(id).success||!parsed.success)throw new BadRequestException("Invalid EPG source configuration");
   return this.service.updateSourceConfiguration(id,parsed.data);
 }

 @Post(":id/test-connection")
 @Header("Cache-Control","no-store")
 async testConnection(@Req() request:ReqLike,@Param("id") id:string){
   await this.assertAdmin(request);
   if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid EPG source");
   if(this.config.get<string>("TV_IMPORTS_ENABLED")!=="true")
     throw new ServiceUnavailableException("EPG diagnostics disabled");
   return this.service.testConnection(id);
 }

 @Post("discoveries/import")
 @Header("Cache-Control","no-store")
 async importDiscoveries(@Req() request:ReqLike,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=z.object({
     countryId:uuid,
     mappingIds:z.array(uuid).min(1).max(50),
   }).strict().safeParse(body);
   if(!parsed.success||new Set(parsed.data.mappingIds).size!==parsed.data.mappingIds.length)
     throw new BadRequestException("Invalid discovered channel selection");
   return this.service.importDiscoveredChannels(
     parsed.data.countryId,parsed.data.mappingIds);
 }

 @Get("discoveries")
 @Header("Cache-Control","no-store")
 async listDiscoveries(@Req() request:ReqLike,
  @Query("page") rawPage?:string,@Query("search") rawSearch?:string,
  @Query("countryId") rawCountryId?:string){
   await this.assertAdmin(request);
   const page=z.coerce.number().int().min(1).max(10000).safeParse(rawPage??"1");
   const search=z.string().max(120).safeParse(rawSearch??"");
   const countryId=rawCountryId&&rawCountryId!=="UNCLASSIFIED"?rawCountryId:null;
   if(!page.success||!search.success||(countryId&&!uuid.safeParse(countryId).success))
     throw new BadRequestException("Invalid EPG discovery filters");
   return this.service.listPendingDiscoveries(50,(page.data-1)*50,search.data,countryId);
 }

 @Get(":id/mappings")
 @Header("Cache-Control","no-store")
 async listMappings(@Req() request:ReqLike,@Param("id") id:string,
  @Query("search") search?:string){
   await this.assertAdmin(request);
   if(!uuid.safeParse(id).success||!z.string().max(120).safeParse(search??"").success)
     throw new BadRequestException("Invalid EPG mapping query");
   return {items:await this.service.listMappings(id,search??"")};
 }

 @Patch(":id/rights")
 @Header("Cache-Control","no-store")
 async updateRights(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=rightsUpdate.safeParse(body);
   if(!uuid.safeParse(id).success||!parsed.success)throw new BadRequestException("Invalid EPG rights");
   const {expectedVersion,...families}=parsed.data;
   return this.service.setRights(id,families,expectedVersion);
 }
 @Get("countries/:id/priorities")
 @Header("Cache-Control","no-store")
 async listCountryPriorities(@Req() request:ReqLike,@Param("id") id:string){
   await this.assertAdmin(request);
   if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid country");
   return this.service.listCountryPriorities(id);
 }
 @Put("countries/:id/priorities")
 @Header("Cache-Control","no-store")
 async replacePriorities(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=priorities.safeParse(body);
   if(!uuid.safeParse(id).success||!parsed.success
     ||parsed.data.items.some(i=>i.countryId!==id))throw new BadRequestException("Invalid priorities");
   return this.service.replaceCountryPriorities(id,parsed.data.items);
 }
 @Post("mappings")
 @Header("Cache-Control","no-store")
 async proposeMapping(@Req() request:ReqLike,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=z.object({sourceId:uuid,externalId:z.string().trim().min(1).max(1000)}).strict().safeParse(body);
   if(!parsed.success)throw new BadRequestException("Invalid external EPG ID");
   return this.service.proposeExternalId(parsed.data.sourceId,parsed.data.externalId);
 }
 @Patch("mappings/:id")
 @Header("Cache-Control","no-store")
 async reviewMapping(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=mapping.safeParse(body);
   if(!uuid.safeParse(id).success||!parsed.success
      ||parsed.data.status==="VERIFIED"&&!parsed.data.channelId
      ||parsed.data.variantId&&!parsed.data.channelId)
     throw new BadRequestException("Invalid EPG mapping");
   return this.service.reviewExternalId(id,parsed.data);
 }
}
