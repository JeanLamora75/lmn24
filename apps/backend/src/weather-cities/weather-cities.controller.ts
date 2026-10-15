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
@Header("Cache-Control","no-store")
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
