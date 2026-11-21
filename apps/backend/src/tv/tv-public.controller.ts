import {
  BadRequestException, Controller, Get, Header, NotFoundException, Param,
  Query, UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { isPublicTvReleased } from "./tv-public-gate";
import { TvPublicService } from "./tv-public.service";
import { todayInZone } from "./tv-public-policy";

const uuid=z.string().uuid();
const iso2=z.string().regex(/^[A-Za-z]{2}$/);
const pageQuery=z.coerce.number().int().min(1).max(10_000).default(1);
const sizeQuery=z.coerce.number().int().min(1).max(100).default(50);
const language=z.enum(["fr","en","de","es","pt","it","ru","nl","all"]).default("all");
const tab=z.enum(["CHANNELS","NOW","TONIGHT","LATE"]).default("TONIGHT");
const display=z.enum(["CHANNEL","VISITOR"]).default("CHANNEL");
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateOrUndefined=day.optional();
const scheduleQuery=z.object({
  country:iso2,localDate:dateOrUndefined,tab,language,
  timeDisplay:display,viewerTimeZone:z.string().max(100).optional(),
  page:pageQuery,pageSize:sizeQuery,
}).strict();
const countryQuery=z.object({locale:language}).strict();
const detailsQuery=z.object({country:iso2,locale:language}).strict();
const airingsQuery=z.object({
  country:iso2,variantId:uuid,localDate:day,page:pageQuery,pageSize:sizeQuery,
}).strict();

/** All public routes are still blocked globally in main.ts before request routing.
 * Controller-level check prevents unit/router bypass, including mistaken Swagger use.
 */
@ApiExcludeController()
@Controller("public/tv")
export class TvPublicController {
  constructor(
    private readonly service:TvPublicService,
    private readonly config:ConfigService,
  ) {}
  private released():void {
    if(!isPublicTvReleased({
      TV_PUBLIC_ENABLED:this.config.get<string>("TV_PUBLIC_ENABLED"),
      TV_PUBLIC_RELEASE_APPROVED:this.config.get<string>("TV_PUBLIC_RELEASE_APPROVED"),
    }))throw new NotFoundException("Not Found");
  }
  private parse<T>(schema:z.ZodType<T>,query:unknown):T {
    const parsed=schema.safeParse(query);
    if(!parsed.success)throw new BadRequestException("TV_INVALID_FILTER");
    return parsed.data;
  }
  private async dayCheck<T>(fn:()=>Promise<T>):Promise<T> {
    try{return await fn();}
    catch(error){
      if(error instanceof RangeError){
        throw new UnprocessableEntityException(error.message==="TV_NOW_ONLY_TODAY"
          ?"TV_NOW_ONLY_TODAY":"TV_DATE_OUTSIDE_J0_J6");
      }
      throw error;
    }
  }

  @Get("countries")
  @Header("Cache-Control","no-store")
  async countries(@Query() query:unknown){
    this.released();
    this.parse(countryQuery,query);
    const countries=await this.service.countries();
    const locale=query && typeof query==="object" && "locale" in query
      &&typeof query.locale==="string" &&query.locale!=="all"?query.locale:"fr";
    const display=new Intl.DisplayNames([locale],{type:"region"});
    return {items:countries.map(c=>({countryIso2:c.isoCode2,
      label:display.of(c.isoCode2)??c.isoCode2,referenceTimeZone:c.referenceTimeZone})),
      languages:this.service.responseLanguages(),
      datePolicy:{daysAhead:7,reference:"COUNTRY_TIME_ZONE"}};
  }

  @Get("schedule")
  @Header("Cache-Control","no-store")
  async schedule(@Query() query:unknown){
    this.released();
    const q=this.parse(scheduleQuery,query);
    if(q.viewerTimeZone){
      try{new Intl.DateTimeFormat("en",{timeZone:q.viewerTimeZone});}
      catch{throw new BadRequestException("TV_INVALID_TIME_ZONE");}
    }
    const country=await this.service.country(q.country);
    const localDate=q.localDate??todayInZone(new Date(),country.referenceTimeZone);
    return this.dayCheck(()=>this.service.schedule({
      country:q.country,localDate,tab:q.tab,page:q.page,pageSize:q.pageSize,
    }));
  }

  @Get("channels/:channelId")
  @Header("Cache-Control","no-store")
  async channel(@Param("channelId") id:string,@Query() query:unknown){
    this.released();
    if(!uuid.safeParse(id).success)throw new BadRequestException("TV_INVALID_FILTER");
    const q=this.parse(detailsQuery,query);
    return this.service.channelDetails(id,q.country);
  }

  @Get("channels/:channelId/airings")
  @Header("Cache-Control","no-store")
  async channelAirings(@Param("channelId") id:string,@Query() query:unknown){
    this.released();
    if(!uuid.safeParse(id).success)throw new BadRequestException("TV_INVALID_FILTER");
    const q=this.parse(airingsQuery,query);
    return this.dayCheck(()=>this.service.channelAirings({
      channelId:id,country:q.country,variantId:q.variantId,localDate:q.localDate,
      page:q.page,pageSize:q.pageSize,
    }));
  }

  @Get("airings/:airingId")
  @Header("Cache-Control","no-store")
  async airing(@Param("airingId") id:string){
    this.released();
    if(!uuid.safeParse(id).success)throw new BadRequestException("TV_INVALID_FILTER");
    return this.service.airingDetails(id);
  }
}
