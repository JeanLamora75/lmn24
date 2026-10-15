"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Continent="EU"|"AS"|"AF"|"NA"|"SA"|"OC";
type City={
 id:string;slug:string;name:string;countryIso2:string;continentCode:Continent;
 latitude:number;longitude:number;timezone:string;displayOrder:number;isActive:boolean;
};
type Input=Omit<City,"id">;
type DeleteImpact={slug:string;name:string;observationCount:number};
const REGIONS:Record<Continent,string>={
 EU:"Europe",AS:"Asie",AF:"Afrique",NA:"Amérique du Nord",
 SA:"Amérique du Sud",OC:"Océanie"
};
const CODES=Object.keys(REGIONS) as Continent[];
const PAGE_SIZES=[10,25,50,100];
const EMPTY:Input={slug:"",name:"",countryIso2:"FR",continentCode:"EU",
 latitude:0,longitude:0,timezone:"Europe/Paris",displayOrder:1,isActive:true};

function flag(code:string) {
 if(!/^[A-Z]{2}$/.test(code))return "🌐";
 return String.fromCodePoint(...Array.from(code).map(c=>c.charCodeAt(0)-65+0x1f1e6));
}
function normalize(s:string) {
 return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
async function request<T>(path:string, init?:RequestInit):Promise<T>{
 const res=await fetch("/api/admin/weather-cities"+path,{cache:"no-store",...init});
 const body:unknown=await res.json().catch(()=>null);
 if(!res.ok) {
   if(res.status===401){ window.location.assign("/admin/login");throw new Error("Session expirée."); }
   if(res.status===403)throw new Error("Accès réservé aux administrateurs.");
   throw new Error(typeof body==="object"&&body&&"message" in body?
     String(body.message):"Une erreur est survenue.");
 }
 return body as T;
}

export function WeatherCitiesClient() {
 const [items,setItems]=useState<City[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [search,setSearch]=useState("");
 const [continent,setContinent]=useState("all");
 const [status,setStatus]=useState("all");
 const [page,setPage]=useState(1);
 const [size,setSize]=useState(25);
 const [editor,setEditor]=useState<City|null|false>(false);
 const [form,setForm]=useState<Input>({...EMPTY});
 const [impact,setImpact]=useState<DeleteImpact|null>(null);
 const [deleting,setDeleting]=useState<City|null>(null);
 const [typed,setTyped]=useState("");

 function load(){
   return request<{items:City[]}>("")
     .then(d=>{setItems(d.items);return d.items;});
 }
 useEffect(()=>{
   let alive=true;
   void request<{items:City[]}>("").then(d=>{
     if(alive){setItems(d.items);setLoading(false);}
   }).catch(e=>{if(alive){setError(String(e));setLoading(false);}});
   return ()=>{alive=false;};
 },[]);
 const filtered=useMemo(()=>items.filter(c=>{
   const matches=!search||normalize([c.name,c.slug,c.countryIso2,REGIONS[c.continentCode]].join(" ")).includes(normalize(search));
   return matches&&(continent==="all"||c.continentCode===continent)
     &&(status==="all"||(status==="active"?c.isActive:!c.isActive));
 }),[items,search,continent,status]);
 const pages=Math.max(1,Math.ceil(filtered.length/size));
 const safePage=Math.min(page,pages);
 const visible=filtered.slice((safePage-1)*size,safePage*size);

 function edit(city?:City) {
   setEditor(city??null);
   setForm(city?{slug:city.slug,name:city.name,countryIso2:city.countryIso2,
     continentCode:city.continentCode,latitude:city.latitude,
     longitude:city.longitude,timezone:city.timezone,displayOrder:city.displayOrder,
     isActive:city.isActive}: {...EMPTY,displayOrder:items.filter(x=>x.continentCode==="EU").length+1});
   setError("");setSuccess("");setDeleting(null);
   window.scrollTo({top:0,behavior:"smooth"});
 }
 async function run(fn:()=>Promise<unknown>,message:string) {
   setBusy(true);setError("");setSuccess("");
   try { await fn();await load();setSuccess(message); }
   catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 }
 function submit(e:FormEvent<HTMLFormElement>) {
   e.preventDefault();
   const id=editor&&editor.id;
   void run(async()=>{
     await request(id?"/"+encodeURIComponent(id):"",{
       method:id?"PUT":"POST",
       headers:{"content-type":"application/json"},
       body:JSON.stringify(form),
     });
     setEditor(false);
   },id?"Ville modifiée.":"Ville ajoutée.");
 }
 async function toggle(city:City) {
   await run(()=>request("/"+city.id+"/status",{
     method:"PATCH",headers:{"content-type":"application/json"},
     body:JSON.stringify({isActive:!city.isActive})
   }),"Statut enregistré.");
 }
 function confirmDelete(city:City) {
   setDeleting(city);setTyped("");setImpact(null);setEditor(false);setError("");
   void request<DeleteImpact>("/"+city.id+"/delete-impact")
     .then(d=>setImpact(d)).catch(e=>setError(String(e)));
 }
 async function remove(){
   if(!deleting||typed!==deleting.slug)return;
   const city=deleting;
   await run(async()=>{
     await request("/"+city.id,{
       method:"DELETE",headers:{"content-type":"application/json"},
       body:JSON.stringify({confirmSlug:typed})
     });
     setDeleting(null);setImpact(null);
   },"Ville supprimée.");
 }
