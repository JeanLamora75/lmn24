import {
 BadRequestException,Body,Controller,ForbiddenException,Get,Header,Param,Patch,Post,Put,Req,
 ServiceUnavailableException,UnauthorizedException,
} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {ApiExcludeController} from "@nestjs/swagger";
import {z} from "zod";
import {AuthService} from "../auth/auth.service";
import {AUTH_FAILURE_MESSAGE,DEFAULT_SESSION_COOKIE_NAME} from "../auth/auth.constants";
import {TvTranslationAdminService,TV_DESCRIPTION_LANGUAGES} from "./tv-translation-admin.service";
import {TvTranslationWorkflowService} from "./tv-translation-workflow.service";

const uuid=z.string().uuid();
const translatePreview=z.object({sourceLanguage:z.enum(TV_DESCRIPTION_LANGUAGES)}).strict();
const translateApprove=z.object({previewId:uuid,languages:z.array(z.enum(TV_DESCRIPTION_LANGUAGES)).min(1).max(7)}).strict();
const manual=z.object({content:z.string().trim().min(1).max(10000),
 expectedVersion:z.string().min(1).max(100).nullable()}).strict();
type Req={headers:Record<string,string|string[]|undefined>};
@ApiExcludeController()
@Controller("admin/tv/translations")
export class TvTranslationAdminController{
 private readonly cookieName:string;
 constructor(private readonly auth:AuthService,private readonly service:TvTranslationAdminService,
  private readonly config:ConfigService,private readonly workflow:TvTranslationWorkflowService){
  this.cookieName=config.get<string>("SESSION_COOKIE_NAME")?.trim()||DEFAULT_SESSION_COOKIE_NAME;
 }
 private async admin(req:Req){
  const cookie=Array.isArray(req.headers.cookie)?req.headers.cookie.join(";"):req.headers.cookie;
  const token=cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith(this.cookieName+"="))
   ?.slice(this.cookieName.length+1);
  const user=await this.auth.getUserFromSession(token);
  if(!user)throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
  if(user.role!=="ADMIN")throw new ForbiddenException("Administrator permission required");
  if(this.config.get<string>("TV_CATALOG_ADMIN_ENABLED")!=="true")
   throw new ServiceUnavailableException("TV administration is not enabled");
 }
 @Get("providers")
 @Header("Cache-Control","no-store")
 async providers(@Req() req:Req){await this.admin(req);return this.service.providers();}
 @Patch("providers/:id/select")
 @Header("Cache-Control","no-store")
 async selectProvider(@Req() req:Req,@Param("id") id:string){
  await this.admin(req);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid provider");
  return this.service.selectProvider(id);
 }
 @Get("channels/:id/descriptions")
 @Header("Cache-Control","no-store")
 async descriptions(@Req() req:Req,@Param("id") id:string){
  await this.admin(req);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid channel");
  return this.service.descriptions(id);
 }
 @Put("channels/:id/descriptions/:language")
 @Header("Cache-Control","no-store")
 async setManual(@Req() req:Req,@Param("id") id:string,@Param("language") language:string,
  @Body() body:unknown){
  await this.admin(req);
  const parsed=manual.safeParse(body);
  if(!uuid.safeParse(id).success||!TV_DESCRIPTION_LANGUAGES.includes(language as typeof TV_DESCRIPTION_LANGUAGES[number])
    ||!parsed.success)throw new BadRequestException("Invalid TV manual description");
  return this.service.setManualDescription(id,language,parsed.data.content,parsed.data.expectedVersion);
 }
 @Get("channels/:id/statuses")
 @Header("Cache-Control","no-store")
 async statuses(@Req() req:Req,@Param("id") id:string){
  await this.admin(req);
  if(!uuid.safeParse(id).success)throw new BadRequestException("Invalid channel");
  return this.workflow.statuses(id);
 }
 @Post("channels/:id/preview")
 @Header("Cache-Control","no-store")
 async preview(@Req() req:Req,@Param("id") id:string,@Body() body:unknown){
  await this.admin(req);const parsed=translatePreview.safeParse(body);
  if(!uuid.safeParse(id).success||!parsed.success)throw new BadRequestException("Invalid translation preview");
  return this.workflow.preview(id,parsed.data.sourceLanguage);
 }
 @Post("channels/:id/approve")
 @Header("Cache-Control","no-store")
 async approve(@Req() req:Req,@Param("id") id:string,@Body() body:unknown){
  await this.admin(req);const parsed=translateApprove.safeParse(body);
  if(!uuid.safeParse(id).success||!parsed.success)throw new BadRequestException("Invalid translation approval");
  return this.workflow.approve(id,parsed.data.previewId,parsed.data.languages);
 }

}
