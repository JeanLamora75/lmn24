export const WEATHER_CONTINENTS={
  EU:"Europe",AS:"Asie",AF:"Afrique",
  NA:"Amérique du Nord",SA:"Amérique du Sud",OC:"Océanie",
} as const;
export type WeatherContinent=keyof typeof WEATHER_CONTINENTS;
export type WeatherRun={
  id:string;
  trigger:"MANUAL"|"AUTOMATIC";
  continentCode:WeatherContinent|null;
  startedAt:string;
  finishedAt:string|null;
  status:"RUNNING"|"SUCCESS"|"PARTIAL"|"ERROR"|"INTERRUPTED";
  totalCities:number;processedCities:number;successfulCities:number;
  failedCities:number;errorMessage:string|null;
};
export type City={id:string;name:string;continentCode:WeatherContinent;isActive:boolean};
export const WEATHER_STATUS:Record<WeatherRun["status"],string>={
  RUNNING:"En cours",SUCCESS:"Succès",PARTIAL:"Partiel",
  ERROR:"Erreur",INTERRUPTED:"Interrompu",
};
export const WEATHER_STATUS_CLASS:Record<WeatherRun["status"],string>={
  RUNNING:"text-bg-primary",SUCCESS:"text-bg-success",PARTIAL:"text-bg-warning",
  ERROR:"text-bg-danger",INTERRUPTED:"text-bg-secondary",
};
export function weatherTargetCount(cities:City[],continent:WeatherContinent|"all"){
  return cities.filter(city=>city.isActive&&(continent==="all"||city.continentCode===continent)).length;
}
export function weatherProgress(run:WeatherRun):number{
  if(run.totalCities<=0)return run.status==="RUNNING"?0:100;
  return Math.max(0,Math.min(100,Math.round(run.processedCities*100/run.totalCities)));
}
export function weatherElapsed(run:WeatherRun):string{
  const start=new Date(run.startedAt).getTime();
  const end=run.finishedAt?new Date(run.finishedAt).getTime():Date.now();
  if(!Number.isFinite(start)||!Number.isFinite(end))return "—";
  const seconds=Math.max(0,Math.floor((end-start)/1000));
  return seconds<60?seconds+" s":Math.floor(seconds/60)+" min "+(seconds%60)+" s";
}
