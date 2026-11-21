/** Civil-day boundaries in IANA timezones, preserving 23/25-hour DST days.
 * No host TZ, fixed 24-hour assumption, or pseudo-UTC shifting.
 */
export function assertLocalDate(localDate:string):string {
  if(!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(localDate))
    throw new RangeError("Invalid local TV date");
  const d=new Date(localDate+"T00:00:00.000Z");
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==localDate)
    throw new RangeError("Nonexistent local TV date");
  return localDate;
}
function localParts(epoch:number,timeZone:string):string {
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23",
  }).formatToParts(new Date(epoch));
  const take=(key:string)=>parts.find(part=>part.type===key)?.value;
  return `${take("year")}-${take("month")}-${take("day")}`;
}
export function localDayBounds(localDate:string,timeZone:string):{
  startMs:number;endMs:number;hours:number;
}{
  assertLocalDate(localDate);
  new Intl.DateTimeFormat("en",{timeZone}); // reject unrecognized IANA zones
  const midnight=Date.parse(localDate+"T00:00:00Z");
  const next=new Date(midnight+86_400_000).toISOString().slice(0,10);
  const boundary=(day:string):number=>{
    // The first instant in [UTC midnight - 15h, midnight + 27h]
    // whose civil calendar date is >= day.
    let lo=Date.parse(day+"T00:00:00Z")-15*3_600_000;
    let hi=Date.parse(day+"T00:00:00Z")+27*3_600_000;
    while(lo<hi){
      const mid=lo+Math.floor((hi-lo)/1000/2)*1000;
      if(localParts(mid,timeZone)>=day)hi=mid;else lo=mid+1000;
    }
    return lo;
  };
  const startMs=boundary(localDate),endMs=boundary(next);
  return {startMs,endMs,hours:(endMs-startMs)/3_600_000};
}
