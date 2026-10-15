import {
 BadRequestException, Body, Controller, Delete, ForbiddenException,
 Get, Header, Param, Patch, Post, Put, Query, Req, UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { AUTH_FAILURE_MESSAGE, DEFAULT_SESSION_COOKIE_NAME } from "../auth/auth.constants";
import { WeatherCitiesService } from "./weather-cities.service";
import {
 weatherCityInputSchema, weatherCityListSchema, weatherCityIdSchema,
 weatherCityStatusSchema, weatherCityDeleteSchema
} from "./weather-city.validation";
type RequestLike = {headers: Record<string,string|string[]|undefined>};

@Controller("admin/weather-cities")
export class WeatherCitiesController {
  private readonly cookieName: string;
  constructor(private readonly service:WeatherCitiesService,
    private readonly auth:AuthService,config:ConfigService) {
    this.cookieName=config.get<string>("SESSION_COOKIE_NAME")?.trim()||DEFAULT_SESSION_COOKIE_NAME;
  }
  private async admin(req:RequestLike) {
    const raw=req.headers.cookie;
    const cookies=Array.isArray(raw)?raw.join(";"):raw||"";
    const token=cookies.split(";").map(s=>s.trim())
      .find(s=>s.startsWith(this.cookieName+"="))?.slice(this.cookieName.length+1);
    const user=await this.auth.getUserFromSession(token);
    if(!user)throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    if(user.role!=="ADMIN")throw new ForbiddenException("Accès réservé aux administrateurs.");
  }
  private id(raw:string) {
    const p=weatherCityIdSchema.safeParse(raw);
    if(!p.success)throw new BadRequestException("Identifiant invalide.");
    return p.data;
  }

  @Header("Cache-Control","no-store")
  @Get()
  async list(@Req() req:RequestLike,@Query() query:Record<string,string|undefined>) {
    await this.admin(req);
    const parsed=weatherCityListSchema.safeParse(query);
    if(!parsed.success)throw new BadRequestException("Filtres météo invalides.");
    return this.service.list(parsed.data);
  }
  @Header("Cache-Control","no-store")
  @Post()
  async create(@Req() req:RequestLike,@Body() body:unknown) {
    await this.admin(req);
    const parsed=weatherCityInputSchema.safeParse(body);
    if(!parsed.success)throw new BadRequestException("Informations invalides.");
    return this.service.save(parsed.data);
  }
  @Header("Cache-Control","no-store")
  @Get(":id/delete-impact")
  async impact(@Req() req:RequestLike,@Param("id") raw:string) {
    await this.admin(req);
    return this.service.deleteImpact(this.id(raw));
  }
  @Header("Cache-Control","no-store")
  @Get(":id")
  async get(@Req() req:RequestLike,@Param("id") raw:string) {
    await this.admin(req);
    return this.service.get(this.id(raw));
  }
  @Header("Cache-Control","no-store")
  @Put(":id")
  async update(@Req() req:RequestLike,@Param("id") raw:string,@Body() body:unknown) {
    await this.admin(req);
    const parsed=weatherCityInputSchema.safeParse(body);
    if(!parsed.success)throw new BadRequestException("Informations invalides.");
    return this.service.save(parsed.data,this.id(raw));
  }
  @Header("Cache-Control","no-store")
  @Patch(":id/status")
  async status(@Req() req:RequestLike,@Param("id") raw:string,@Body() body:unknown) {
    await this.admin(req);
    const parsed=weatherCityStatusSchema.safeParse(body);
    if(!parsed.success)throw new BadRequestException("Statut invalide.");
    return this.service.setStatus(this.id(raw),parsed.data.isActive);
  }
  @Header("Cache-Control","no-store")
  @Delete(":id")
  async remove(@Req() req:RequestLike,@Param("id") raw:string,@Body() body:unknown) {
    await this.admin(req);
    const parsed=weatherCityDeleteSchema.safeParse(body);
    if(!parsed.success)throw new BadRequestException("Confirmation obligatoire.");
    return this.service.remove(this.id(raw),parsed.data.confirmSlug);
  }
}
