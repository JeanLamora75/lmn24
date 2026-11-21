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
const right=z.object({status:rightsStatus,reference:z.string().max(2048).nullable()}).strict()
 .refine(v=>v.status!=="APPROVED"||!!v.reference?.trim(),"Rights evidence required");
const rights=z.object({programme:right,synopsis:right,image:right,logo:right}).strict();
const source=z.object({
 name:z.string().trim().min(1).max(255),
 sourceUrl:z.string().max(2048),format:z.enum(["XMLTV","XMLTV_GZIP","JSON"]),
 isActive:z.boolean(),rights,
}).strict();
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
 @Patch(":id/rights")
 @Header("Cache-Control","no-store")
 async updateRights(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
   await this.assertAdmin(request);
   const parsed=rights.safeParse(body);
   if(!uuid.safeParse(id).success||!parsed.success)throw new BadRequestException("Invalid EPG rights");
   return this.service.setRights(id,parsed.data);
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
