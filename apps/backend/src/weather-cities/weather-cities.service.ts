import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lmn24/database";
import { DatabaseService } from "../database/database.service";
import type { WeatherCityInput } from "./weather-city.validation";

type Tx = Prisma.TransactionClient;
const fields = {
  id:true, name:true, slug:true, countryIso2:true, continentCode:true,
  latitude:true, longitude:true, timezone:true, displayOrder:true,
  isActive:true, createdAt:true, updatedAt:true,
} as const;

@Injectable()
export class WeatherCitiesService {
  constructor(private readonly db: DatabaseService) {}

  private serialize(city: {latitude:Prisma.Decimal;longitude:Prisma.Decimal}) {
    return {...city, latitude:Number(city.latitude), longitude:Number(city.longitude)};
  }

  async list(f:{continent:string;status:string;search:string}) {
    const where:Prisma.WeatherCityWhereInput = {
      ...(f.continent!=="all"?{continentCode:f.continent}:{}),
      ...(f.status!=="all"?{isActive:f.status==="active"}:{}),
      ...(f.search?{OR:[
        {name:{contains:f.search,mode:"insensitive"}},
        {slug:{contains:f.search,mode:"insensitive"}},
        {countryIso2:{contains:f.search.toUpperCase()}},
      ]}:{}),
    };
    const [items,total,active]=await Promise.all([
      this.db.prisma.weatherCity.findMany({where,select:fields,
        orderBy:[{continentCode:"asc"},{displayOrder:"asc"},{id:"asc"}]}),
      this.db.prisma.weatherCity.count(),
      this.db.prisma.weatherCity.count({where:{isActive:true}}),
    ]);
    return {items:items.map(c=>this.serialize(c)),total,active};
  }

  async get(id:string) {
    const city=await this.db.prisma.weatherCity.findUnique({where:{id},select:fields});
    if(!city)throw new NotFoundException("Ville météo introuvable.");
    return this.serialize(city);
  }

  async deleteImpact(id:string) {
    const city=await this.db.prisma.weatherCity.findUnique({
      where:{id},select:{name:true,slug:true,current:{select:{cityId:true}}}
    });
    if(!city)throw new NotFoundException("Ville météo introuvable.");
    return {name:city.name,slug:city.slug,observationCount:city.current?1:0};
  }

  async setStatus(id:string,isActive:boolean) {
    await this.get(id);
    return this.db.prisma.weatherCity.update({
      where:{id},data:{isActive},select:{id:true,isActive:true}
    });
  }

  private async lock(tx:Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(241024,70)`;
  }

  // Two-phase reorder: move positions to unused high numbers first.
  private async order(tx:Tx,continent:string,ids:string[]) {
    if(!ids.length)return;
    const rows=await tx.weatherCity.findMany({
      where:{continentCode:continent},select:{id:true,displayOrder:true}
    });
    if(rows.length!==ids.length || new Set(ids).size!==ids.length ||
       rows.some(x=>!ids.includes(x.id)))
      throw new ConflictException("Le classement a changé. Actualisez.");
    const top=Math.max(...rows.map(x=>x.displayOrder));
    const offset=top+rows.length+1;
    if(top+offset>32767)throw new BadRequestException("Limite de classement atteinte.");
    await tx.weatherCity.updateMany({
      where:{continentCode:continent},
      data:{displayOrder:{increment:offset}},
    });
    for(const [index,id] of ids.entries())
      await tx.weatherCity.update({where:{id},data:{displayOrder:index+1}});
  }

  private async fromTx(tx:Tx,id:string) {
    return this.serialize(await tx.weatherCity.findUniqueOrThrow({where:{id},select:fields}));
  }
