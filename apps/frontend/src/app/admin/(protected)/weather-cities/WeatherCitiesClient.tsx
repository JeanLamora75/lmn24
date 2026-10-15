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

 return <main className="container-fluid px-3 px-lg-4 py-4">
   <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
     <div>
       <h1 className="h2 mb-1">Villes météo</h1>
       <p className="text-body-secondary mb-0">Gérez les villes suivies par la météo mondiale LMN24.</p>
     </div>
     <div className="d-flex flex-wrap gap-2">
       <Link href="/admin" className="btn btn-outline-secondary">Retour administration</Link>
       <button className="btn btn-primary" type="button" disabled={busy}
         onClick={()=>editor===false?edit():setEditor(false)}>
         {editor===false?"Ajouter une ville":"Fermer le formulaire"}
       </button>
     </div>
   </header>
   {error&&<div className="alert alert-danger" role="alert">{error}</div>}
   {success&&<div className="alert alert-success" role="status">{success}</div>}
   {editor!==false&&<section className="card shadow-sm mb-4" aria-label="Formulaire de ville météo">
     <div className="card-header fw-semibold">{editor?"Modifier la ville":"Ajouter une ville"}</div>
     <form className="card-body" onSubmit={submit}>
       <div className="row g-3">
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-name">Nom de la ville</label>
           <input id="weather-name" className="form-control" required maxLength={120}
             value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-slug">Slug unique</label>
           <input id="weather-slug" className="form-control" required
             pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120}
             value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-country">Pays (code ISO2)</label>
           <input id="weather-country" className="form-control" required minLength={2} maxLength={2}
             pattern="[A-Za-z]{2}" value={form.countryIso2}
             onChange={e=>setForm({...form,countryIso2:e.target.value.toUpperCase()})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-continent">Continent</label>
           <select id="weather-continent" className="form-select" value={form.continentCode}
             onChange={e=>{
               const next=e.target.value as Continent;
               setForm({...form,continentCode:next,displayOrder:items.filter(x=>x.continentCode===next && x.id!==editor?.id).length+1});
             }}>
             {CODES.map(code=><option key={code} value={code}>{REGIONS[code]}</option>)}
           </select>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-latitude">Latitude</label>
           <input id="weather-latitude" className="form-control" required type="number"
             step="any" min="-90" max="90" value={form.latitude}
             onChange={e=>setForm({...form,latitude:Number(e.target.value)})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-longitude">Longitude</label>
           <input id="weather-longitude" className="form-control" required type="number"
             step="any" min="-180" max="180" value={form.longitude}
             onChange={e=>setForm({...form,longitude:Number(e.target.value)})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-timezone">Fuseau horaire IANA</label>
           <input id="weather-timezone" className="form-control" required maxLength={64}
             placeholder="Europe/Paris" value={form.timezone}
             onChange={e=>setForm({...form,timezone:e.target.value})}/>
           <div className="form-text">Ex. Europe/Paris, Asia/Tokyo, America/New_York.</div>
         </div>
         <div className="col-12 col-md-6 col-xl-4">
           <label className="form-label" htmlFor="weather-order">Position dans le continent</label>
           <input id="weather-order" className="form-control" required type="number"
             min={1} max={32760} step={1} value={form.displayOrder}
             onChange={e=>setForm({...form,displayOrder:Number(e.target.value)})}/>
         </div>
         <div className="col-12 col-md-6 col-xl-4 d-flex align-items-end">
           <div className="form-check mb-2">
             <input className="form-check-input" id="weather-active" type="checkbox"
               checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>
             <label className="form-check-label" htmlFor="weather-active">Ville active</label>
           </div>
         </div>
       </div>
       <div className="d-flex flex-wrap gap-2 mt-4">
         <button className="btn btn-primary" disabled={busy} type="submit">
           {busy?"Enregistrement…":"Enregistrer"}
         </button>
         <button className="btn btn-outline-secondary" type="button"
           disabled={busy} onClick={()=>setEditor(false)}>Annuler</button>
       </div>
     </form>
   </section>}
   {deleting&&<section className="card border-danger mb-4" aria-label="Confirmation de suppression">
     <div className="card-header fw-semibold text-danger">Supprimer {deleting.name} ?</div>
     <div className="card-body">
       <p>Cette suppression est définitive. Elle effacera aussi son dernier relevé météo
         {impact?" ("+impact.observationCount+" relevé)":""}, mais conservera toutes les autres villes.</p>
       <label className="form-label" htmlFor="weather-confirm">
         Saisissez exactement <strong>{deleting.slug}</strong> pour confirmer.
       </label>
       <input id="weather-confirm" className="form-control mb-3" autoComplete="off"
         value={typed} onChange={e=>setTyped(e.target.value)}/>
       <div className="d-flex gap-2 flex-wrap">
         <button className="btn btn-danger" type="button"
           disabled={busy||!impact||typed!==deleting.slug} onClick={()=>void remove()}>
           Supprimer définitivement
         </button>
         <button className="btn btn-outline-secondary" type="button"
           disabled={busy} onClick={()=>{setDeleting(null);setImpact(null);}}>Annuler</button>
       </div>
     </div>
   </section>}
