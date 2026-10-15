import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { HoroscopeImportService } from "./horoscope-import.service";

type RequestLike={headers:Record<string,string|string[]|undefined>};
@Controller("admin/horoscopes")
export class HoroscopeImportController {
  private readonly cookieName:string;
  private readonly allowedOrigins:string[];
  constructor(private readonly imports:HoroscopeImportService, private readonly auth:AuthService,config:ConfigService){
    this.cookieName=config.get<string>("SESSION_COOKIE_NAME")?.trim()||DEFAULT_SESSION_COOKIE_NAME;
    this.allowedOrigins=(config.get<string>("CORS_ORIGINS")||"http://localhost:3000").split(",").map(x=>x.trim());
  }
  private async authorize(req:RequestLike,mutation=false){
    const cookie=Array.isArray(req.headers.cookie)?req.headers.cookie.join(";"):req.headers.cookie??"";
    const token=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(this.cookieName+"="))?.slice(this.cookieName.length+1);
    const user=await this.auth.getUserFromSession(token);
    if(!user)throw new UnauthorizedException();
    if(user.role!=="ADMIN")throw new ForbiddenException();
    if(mutation){
      const origin=req.headers.origin;
      if(typeof origin!=="string"||!this.allowedOrigins.includes(origin))throw new ForbiddenException("Origine non autorisée.");
    }
    return user;
  }
  @Get("files") @Header("Cache-Control","no-store")
  async files(@Req()req:RequestLike){await this.authorize(req);return this.imports.files();}
  @Get("overview") @Header("Cache-Control","no-store")
  async overview(@Req()req:RequestLike){await this.authorize(req);return this.imports.overview();}
  @Get("preview/:fileName/:sign/:language") @Header("Cache-Control","no-store")
  async preview(@Req()req:RequestLike,@Param("fileName")fileName:string,@Param("sign")sign:string,@Param("language")language:string){
    await this.authorize(req);
    if(!/^(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)$/.test(sign)
       || !/^(fr|en|de|es|it|pt|ru|nl)$/.test(language))throw new BadRequestException();
    return this.imports.preview(fileName,sign,language);
  }
  @Get("history") @Header("Cache-Control","no-store")
  async history(@Req()req:RequestLike){await this.authorize(req);return this.imports.history();}
  @Post("files/:fileName/import") @Header("Cache-Control","no-store")
  async fromFile(@Req()req:RequestLike,@Param("fileName")fileName:string){
    const user=await this.authorize(req,true);return this.imports.importFile(fileName,user.id);
  }
  @Post("upload") @Header("Cache-Control","no-store")
  async upload(@Req()req:RequestLike,@Body()body:unknown){
    const user=await this.authorize(req,true);
    if(!body||typeof body!=="object"||Array.isArray(body))throw new BadRequestException();
    const input=body as Record<string,unknown>;
    if(typeof input.fileName!=="string"||typeof input.content!=="string"||input.content.length>1_500_000)
      throw new BadRequestException("Upload JSON invalide.");
    return this.imports.importContent(input.content,input.fileName,user.id,"UPLOAD");
  }
}
