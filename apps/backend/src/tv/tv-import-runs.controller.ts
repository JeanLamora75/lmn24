import {
 BadRequestException,Body,Controller,ForbiddenException,Get,Header,Param,Post,Req,
 ServiceUnavailableException,UnauthorizedException,Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { TvImportRunsService } from "./tv-import-runs.service";
import { TvImportExecutionService } from "./tv-import-execution.service";

const uuid=z.string().uuid();
const executionRequest=z.object({mode:z.literal("DISCOVERY")}).strict();
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
             private readonly config:ConfigService,private readonly execution:TvImportExecutionService){
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
 @Get()
 @Header("Cache-Control","no-store")
 async list(@Req() request:ReqLike,@Query("page") page?:string,@Query("pageSize") pageSize?:string){
  await this.authorize(request);
  const n=z.coerce.number().int().min(1).max(1000).safeParse(page??1);
  const s=z.coerce.number().int().min(1).max(100).safeParse(pageSize??20);
  if(!n.success||!s.success)throw new BadRequestException("Invalid TV import pagination");
  return this.runs.listRuns(n.data,s.data);
 }
 @Post()
 @Header("Cache-Control","no-store")
 async enqueue(@Req() request:ReqLike,@Body() body:unknown){
  await this.authorize(request);
  const parsed=importRequest.safeParse(body);
  if(!parsed.success)throw new BadRequestException("Invalid TV import request");
  return this.runs.create({...parsed.data,trigger:"MANUAL"});
 }
 @Get("execution-status")
 @Header("Cache-Control","no-store")
 async executionStatus(@Req() request:ReqLike){
  await this.authorize(request);
  return this.execution.readiness();
 }
 @Post(":id/execute")
 @Header("Cache-Control","no-store")
 async execute(@Req() request:ReqLike,@Param("id") id:string,@Body() body:unknown){
  await this.authorize(request);
  const parsed=executionRequest.safeParse(body);
  if(!uuid.safeParse(id).success||!parsed.success)
   throw new BadRequestException("Invalid TV discovery execution request");
  return this.execution.startDiscovery(id);
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
