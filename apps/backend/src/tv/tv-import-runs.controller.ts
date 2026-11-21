import {
 BadRequestException,Body,Controller,ForbiddenException,Get,Header,Param,Post,Req,
 ServiceUnavailableException,UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { TvImportRunsService } from "./tv-import-runs.service";

const uuid=z.string().uuid();
const importRequest=z.object({
 days:z.number().int().min(1).max(7),
 countryId:uuid.optional(),
}).strict();
type ReqLike={headers:Record<string,string|string[]|undefined>};

/** Manual enqueue is admin-only, default OFF; not an ingestion scheduler. */
@ApiExcludeController()
@Controller("admin/tv/import-runs")
export class TvImportRunsController {
 private readonly cookieName:string;
 constructor(private readonly auth:AuthService,private readonly runs:TvImportRunsService,
             private readonly config:ConfigService){
  this.cookieName=config.get<string>("SESSION_COOKIE_NAME")?.trim()||DEFAULT_SESSION_COOKIE_NAME;
 }
 private async authorize(request:ReqLike):Promise<void>{
  const raw=Array.isArray(request.headers.cookie)?request.headers.cookie.join(";"):request.headers.cookie;
  const token=raw?.split(";").map(x=>x.trim()).find(x=>x.startsWith(this.cookieName+"="))
     ?.slice(this.cookieName.length+1);
  const user=await this.auth.getUserFromSession(token);
  if(!user)throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
  if(user.role!=="ADMIN")throw new ForbiddenException("Administrator permission required");
  if(this.config.get<string>("TV_CATALOG_ADMIN_ENABLED")!=="true"
     ||this.config.get<string>("TV_IMPORTS_ENABLED")!=="true")
    throw new ServiceUnavailableException("TV import administration is not enabled");
 }
 @Post()
 @Header("Cache-Control","no-store")
 async enqueue(@Req() request:ReqLike,@Body() body:unknown){
  await this.authorize(request);
  const parsed=importRequest.safeParse(body);
  if(!parsed.success)throw new BadRequestException("Invalid TV import request");
  return this.runs.create({...parsed.data,trigger:"MANUAL"});
 }
 @Get(":id")
 @Header("Cache-Control","no-store")
 async get(@Req() request:ReqLike,@Param("id") id:string){
  await this.authorize(request);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid TV import ID");
  return this.runs.getRun(id);
 }
 @Get(":id/events")
 @Header("Cache-Control","no-store")
 async events(@Req() request:ReqLike,@Param("id") id:string){
  await this.authorize(request);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid TV import ID");
  return {items:await this.runs.getEvents(id)};
 }
 @Post(":id/retry")
 @Header("Cache-Control","no-store")
 async retry(@Req() request:ReqLike,@Param("id") id:string){
  await this.authorize(request);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid TV import ID");
  return this.runs.retryFailed(id);
 }
}
