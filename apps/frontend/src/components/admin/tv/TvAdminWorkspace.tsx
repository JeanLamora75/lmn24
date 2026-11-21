"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {TvTranslationPanel} from "./TvTranslationPanel";
import {TvEpgSourceEditor} from "./TvEpgSourceEditor";
import {AdminPageHeading,AdminFilterPanel,AdminDataPanel} from "@/components/admin/AdminWorkspace";
import {AdminPagination} from "@/components/admin/AdminPagination";
import {AdminIconButton} from "@/components/admin/AdminIcon";
import {useAdminSessionFilter} from "@/lib/admin-session-filters";
import styles from "@/app/admin/(protected)/tv/tv-admin.module.css";

export type TvView="overview"|"countries"|"channels"|"sources"|"imports"|"translations"|"statistics";
type Country={countryId:string;isoCode2:string;referenceTimezone:string;isActive:boolean;
 channelCount:number;approvedChannelCount:number;version:string};
type Channel={id:string;countryId:string;channelId:string;slug:string;name:string;
 isActive:boolean;needsReview:boolean;effectiveNumber:number|null;manualNumber:number|null;
 officialNumber:number|null;assignedNumber:number|null;defaultVariantId:string|null;version:string};
type Source={id:string;name:string;sourceUrl:string;format:string;isActive:boolean;version:string;
 programmeRightsStatus:string;programmeRightsReference:string|null;
 synopsisRightsStatus:string;synopsisRightsReference:string|null;imageRightsStatus:string;
 imageRightsReference:string|null;logoRightsStatus:string;logoRightsReference:string|null;
 countryId:string|null;priority:number|null;lastImportStatus:string|null};
type ImportRun={id:string;trigger:string;requestedDays:number;status:string;createdAt:string;
 scopeCount:number;succeeded:number;failed:number};
type ImportDetail=ImportRun&{scopes:{id:string;countryId:string;sourceId:string|null;
 status:string;attempts:number;errorMessage:string|null}[]};
type ImportEvent={id:string;occurredAt:string;eventType:string;level:string;message:string};
const LABELS:Record<TvView,string>={
 overview:"Vue d'ensemble",countries:"Pays",channels:"Chaînes",
 sources:"Sources EPG",imports:"Imports",translations:"Traductions",statistics:"Statistiques",
};
const api="/api/admin/tv/";
const PAGE_SIZE=20;
const timezoneOptions=(()=>{try{return Intl.supportedValuesOf("timeZone");}
 catch{return ["Europe/Paris","Europe/London","America/New_York","Asia/Tokyo","UTC"];}})();
function region(iso:string){try{return new Intl.DisplayNames(["fr"],{type:"region"}).of(iso)??iso;}
 catch{return iso;}}
function messageFor(status:number):string{
 if(status===401)return "Votre session a expiré. Reconnectez-vous.";
 if(status===403)return "Accès réservé aux administrateurs.";
 if(status===409)return "Modification concurrente ou conflit : actualisez avant de réessayer.";
 if(status===503)return "Module TV indisponible : schéma ou fonctionnalité non activé.";
 return "Opération impossible. Vérifiez les données puis réessayez.";
}
async function request<T>(path:string,method="GET",payload?:unknown):Promise<T>{
 const response=await fetch(api+path,{method,cache:"no-store",
  headers:payload===undefined?undefined:{"content-type":"application/json"},
  body:payload===undefined?undefined:JSON.stringify(payload)});
 if(!response.ok)throw Object.assign(new Error(messageFor(response.status)),{status:response.status});
 return await response.json() as T;
}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 return <div className={styles.dialogBackdrop} onMouseDown={event=>{
   if(event.target===event.currentTarget)onClose();
  }}>
  <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="tv-admin-modal-title"
   onKeyDown={event=>{if(event.key==="Escape")onClose();}}>
   <div className="d-flex justify-content-between gap-2 align-items-center mb-3">
    <h2 id="tv-admin-modal-title" className="mb-0">{title}</h2>
    <button type="button" className="btn btn-outline-secondary" onClick={onClose} aria-label="Fermer">×</button>
   </div>{children}
  </div>
 </div>;
}
function CountryEditor({item,onClose,onSaved}:{item:Country;onClose:()=>void;onSaved:()=>void}){
 const [active,setActive]=useState(item.isActive);
 const [zone,setZone]=useState(item.referenceTimezone);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const options=timezoneOptions.includes(zone)?timezoneOptions:[zone,...timezoneOptions];
 return <Modal title={"Paramètres TV — "+region(item.isoCode2)} onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;
    setBusy(true);setError("");
    try{await request("catalog/countries/"+item.countryId,"PUT",{
      referenceTimezone:zone,isActive:active,expectedVersion:item.version,
    });onSaved();}catch(err){setError((err as Error).message);}finally{setBusy(false);}
   }}>
   <label className="form-label" htmlFor="tv-country-zone">Fuseau IANA de référence</label>
   <select id="tv-country-zone" className="form-select mb-3" value={zone} onChange={e=>setZone(e.target.value)}>
    {options.map(x=><option key={x} value={x}>{x}</option>)}
   </select>
   <label className="form-check mb-3">
    <input className="form-check-input" type="checkbox" checked={active}
     onChange={e=>setActive(e.target.checked)}/>
    <span className="form-check-label">Pays disponible pour le Guide TV</span>
   </label>
   {!active&&<p className="text-body-secondary">Les chaînes de ce pays seront masquées du public ; leurs réglages seront conservés. Les imports manuels restent possibles.</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
    <button type="submit" disabled={busy} className="btn btn-primary">Enregistrer</button>
   </div>
  </form>
 </Modal>;
}
function ChannelEditor({item,onClose,onSaved}:{item:Channel;onClose:()=>void;onSaved:()=>void}){
 const [number,setNumber]=useState(item.manualNumber===null?"":String(item.manualNumber));
 const [active,setActive]=useState(item.isActive);
 const [review,setReview]=useState(item.needsReview);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 return <Modal title={"Diffusion — "+item.name} onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");
   const n=number.trim()===""?null:Number(number);
   if(n!==null&&(!Number.isInteger(n)||n<1||n>2147483647)){
    setError("Numéro national invalide.");setBusy(false);return;
   }
   try{await request("catalog/associations/"+item.id,"PATCH",{
    isActive:active,needsReview:review,manualNumber:n,
    officialNumber:item.officialNumber,assignedNumber:item.assignedNumber,
    defaultVariantId:item.defaultVariantId,expectedVersion:item.version,
   });onSaved();}catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
   <p className="text-body-secondary">Numéro actuel : {item.effectiveNumber??"Non attribué"}.
    La correction manuelle prime sur les numéros importés.</p>
   <label htmlFor="tv-manual-number" className="form-label">Numéro national manuel</label>
   <input id="tv-manual-number" type="number" min="1" className="form-control mb-3"
    value={number} onChange={e=>setNumber(e.target.value)}/>
   <label className="form-check mb-2">
    <input type="checkbox" className="form-check-input" checked={active}
     onChange={e=>setActive(e.target.checked)}/>
    <span className="form-check-label">Active dans ce pays</span>
   </label>
   <label className="form-check mb-3">
    <input type="checkbox" className="form-check-input" checked={review}
     onChange={e=>setReview(e.target.checked)}/>
    <span className="form-check-label">À vérifier (masquée du public)</span>
   </label>
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end">
    <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Annuler</button>
    <button className="btn btn-primary" type="submit" disabled={busy}>Enregistrer</button>
   </div>
  </form>
 </Modal>;
}
const rights=["programme","synopsis","image","logo"] as const;
type RightsName=typeof rights[number];
function SourceEditor({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
 const [name,setName]=useState("");const [url,setUrl]=useState("");
 const [format,setFormat]=useState("XMLTV");const [active,setActive]=useState(false);
 const [rightsData,setRightsData]=useState<Record<RightsName,{status:string;reference:string}>>({
  programme:{status:"UNREVIEWED",reference:""},synopsis:{status:"UNREVIEWED",reference:""},
  image:{status:"UNREVIEWED",reference:""},logo:{status:"UNREVIEWED",reference:""},
 });
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <Modal title="Ajouter une source EPG" onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;
   setBusy(true);setError("");
   try{
    const rightsPayload=Object.fromEntries(rights.map(k=>[k,{
     status:rightsData[k].status,reference:rightsData[k].reference.trim()||null,
    }]));
    await request("epg-sources","POST",{name,sourceUrl:url,format,isActive:active,rights:rightsPayload});
    onSaved();
   }catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
   <div className={styles.formGrid}>
    <label>Nom<input className="form-control" required maxLength={255} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Format<select className="form-select" value={format} onChange={e=>setFormat(e.target.value)}>
     {["XMLTV","XMLTV_GZIP","JSON"].map(v=><option key={v}>{v}</option>)}</select></label>
   </div>
   <label className="d-block mt-3">URL de collecte<input className="form-control" required type="url"
    value={url} onChange={e=>setUrl(e.target.value)}/></label>
   <label className="form-check mt-3"><input type="checkbox" className="form-check-input" checked={active}
    onChange={e=>setActive(e.target.checked)}/><span className="form-check-label">Source active</span></label>
   <fieldset className="mt-3"><legend className="fs-6 fw-bold">Droits par type de contenu</legend>
    {rights.map(key=><div key={key} className="mb-2">
     <label className="form-label text-capitalize" htmlFor={"rights-"+key}>{key}</label>
     <div className={styles.formGrid}>
      <select id={"rights-"+key} className="form-select" value={rightsData[key].status}
       onChange={e=>setRightsData(old=>({...old,[key]:{...old[key],status:e.target.value}}))}>
       {["UNREVIEWED","APPROVED","REJECTED","EXPIRED"].map(v=><option key={v}>{v}</option>)}
      </select>
      <input className="form-control" aria-label={"Justificatif "+key} placeholder="Référence de droits"
       required={rightsData[key].status==="APPROVED"} maxLength={2048}
       value={rightsData[key].reference}
       onChange={e=>setRightsData(old=>({...old,[key]:{...old[key],reference:e.target.value}}))}/>
     </div>
    </div>)}
   </fieldset>
   <p className="small text-body-secondary">La source reste non approuvée pour toute famille sans justificatif. La validation serveur contrôle également l’URL.</p>
   {error&&<p className="alert alert-danger" role="alert">{error}</p>}
   <div className="d-flex justify-content-end gap-2">
    <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Annuler</button>
    <button className="btn btn-primary" disabled={busy} type="submit">Créer</button>
   </div>
  </form>
 </Modal>;
}
function ImportEditor({countries,onClose,onSaved}:{countries:Country[];onClose:()=>void;onSaved:(id:string)=>void}){
 const [country,setCountry]=useState("");const [days,setDays]=useState(7);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const eligible=country?countries.filter(c=>c.countryId===country):countries.filter(c=>c.isActive);
 return <Modal title="Lancer un import EPG manuel" onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy||eligible.length===0)return;
   setBusy(true);setError("");
   try{const created=await request<{id:string}>("import-runs","POST",{
    days,...(country?{countryId:country}:{})});
    onSaved(created.id);
   }catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
   <label className="form-label" htmlFor="tv-import-scope">Périmètre</label>
   <select id="tv-import-scope" className="form-select mb-3" value={country}
    onChange={e=>setCountry(e.target.value)}>
    <option value="">Tous les pays TV actifs</option>
    {countries.map(x=><option key={x.countryId} value={x.countryId}>
     {region(x.isoCode2)}{x.isActive?"":" (inactif)"}</option>)}
   </select>
   <label className="form-label" htmlFor="tv-import-days">Nombre de jours</label>
   <select id="tv-import-days" className="form-select mb-3" value={days}
    onChange={e=>setDays(Number(e.target.value))}>
    {[1,2,3,4,5,6,7].map(x=><option key={x} value={x}>{x}</option>)}
   </select>
   <p className="text-body-secondary">{eligible.length} pays concernés.
    L’import manuel d’un pays inactif est autorisé. Les sources réellement utilisables
    et leurs droits sont contrôlés au serveur avant mise en file.</p>
   {eligible.length===0&&<p className="alert alert-warning">Aucun pays éligible.</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
    <button type="submit" disabled={busy||eligible.length===0} className="btn btn-primary">Lancer l'import</button>
   </div>
  </form>
 </Modal>;
}

export function TvAdminWorkspace({view}:{view:TvView}){
 const router=useRouter();
 const [countries,setCountries]=useState<Country[]>([]);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [sources,setSources]=useState<Source[]>([]);
 const [runs,setRuns]=useState<ImportRun[]>([]);
 const [detail,setDetail]=useState<ImportDetail|null>(null);
 const [events,setEvents]=useState<ImportEvent[]>([]);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);const [reload,setReload]=useState(0);
 const [dialog,setDialog]=useState<"source"|"import"|null>(null);
 const [countryEditor,setCountryEditor]=useState<Country|null>(null);
 const [channelEditor,setChannelEditor]=useState<Channel|null>(null);
 const [sourceEditor,setSourceEditor]=useState<Source|null>(null);
 const [filter,setFilter]=useAdminSessionFilter("tv-"+view,"search","");
 const [country,setCountry]=useAdminSessionFilter("tv-"+view,"country","");
 const [status,setStatus]=useAdminSessionFilter("tv-"+view,"status","all");
 const [page,setPage]=useAdminSessionFilter("tv-"+view,"page",1);
 const [selectedRun,setSelectedRun]=useState("");
 useEffect(()=>{
  const abort=new AbortController();const current=reload;
  async function load(){
   setLoading(true);setError("");
   try{
    const paths:{[key:string]:string}={
     countries:"catalog/countries",channels:"catalog/channels",sources:"epg-sources",
     imports:"import-runs?page=1&pageSize=100"};
    const requested=view==="overview"||view==="statistics"?
     ["catalog/countries","catalog/channels","epg-sources","import-runs?page=1&pageSize=100"]:
     view==="translations"?["catalog/channels"]:
     [paths[view]??"catalog/countries","catalog/countries"];
    const unique=[...new Set(requested)];
    const responses=await Promise.all(unique.map(async name=>{
     const response=await fetch(api+name,{cache:"no-store",signal:abort.signal});
     if(response.status===401){router.replace("/admin/login");throw new Error(messageFor(401));}
     if(!response.ok)throw new Error(messageFor(response.status));
     return [name,await response.json()] as const;
    }));
    if(abort.signal.aborted||current!==reload)return;
    for(const [name,payload] of responses){
     if(name==="catalog/countries")setCountries((payload as {items:Country[]}).items);
     else if(name==="catalog/channels")setChannels((payload as {items:Channel[]}).items);
     else if(name==="epg-sources")setSources((payload as {items:Source[]}).items);
     else if(name.startsWith("import-runs"))setRuns((payload as {items:ImportRun[]}).items);
    }
   }catch(e){if(!abort.signal.aborted)setError((e as Error).message);}
   finally{if(!abort.signal.aborted)setLoading(false);}
  }
  void load();return ()=>abort.abort();
 },[view,reload,router]);
 async function openRun(id:string){
  setSelectedRun(id);setDetail(null);setEvents([]);
  try{
   const [d,e]=await Promise.all([
    request<ImportDetail>("import-runs/"+id),
    request<{items:ImportEvent[]}>("import-runs/"+id+"/events"),
   ]);
   setDetail(d);setEvents(e.items);
  }catch(err){setError((err as Error).message);}
 }
 function saved(){setDialog(null);setCountryEditor(null);setChannelEditor(null);setSourceEditor(null);setReload(v=>v+1);}
 const countryCodes=useMemo(()=>new Map(countries.map(c=>[c.countryId,c.isoCode2])),[countries]);
 const filtered=useMemo(()=>{
  const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const pool=view==="countries"?countries:view==="channels"?channels:view==="sources"?sources:runs;
  return pool.filter(item=>{
   const joined=normal(JSON.stringify(item));
   if(filter&&!joined.includes(normal(filter)))return false;
   if(country&&("countryId" in item)&&item.countryId!==country)return false;
   if(status==="active"&&("isActive" in item)&&!item.isActive)return false;
   if(status==="inactive"&&("isActive" in item)&&item.isActive)return false;
   if(status==="review"&&("needsReview" in item)&&!item.needsReview)return false;
   return true;
  });
 },[view,countries,channels,sources,runs,filter,country,status]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const visible=filtered.slice((Math.min(page,pages)-1)*PAGE_SIZE,Math.min(page,pages)*PAGE_SIZE);
 const action=view==="sources"?<button className="btn btn-primary" type="button" onClick={()=>setDialog("source")}>Ajouter une source EPG</button>
  :view==="imports"?<button className="btn btn-primary" type="button" onClick={()=>setDialog("import")}>Lancer un import</button>:undefined;
 return <main className="container-fluid px-2 px-md-4 py-3">
  <AdminPageHeading title={"Guide TV — "+LABELS[view]}
   description="Administration du Guide TV mondial ; publication publique indépendante et désactivée avant GO."
   actions={action}/>
  {error&&<div role="alert" className="alert alert-danger">{error}
   <button className="btn btn-outline-danger ms-2" type="button" onClick={()=>setReload(v=>v+1)}>Réessayer</button></div>}
  {notice&&<div role="status" className="alert alert-info">{notice}</div>}
  {loading&&<p role="status">Chargement des données TV…</p>}
  {(view==="countries"||view==="channels"||view==="sources"||view==="imports")&&
   <AdminFilterPanel>
    <div className="row g-3">
     <label className="col-12 col-md-4">Recherche
      <input className="form-control" type="search" value={filter}
       onChange={e=>{setFilter(e.target.value);setPage(1);}}/>
     </label>
     {view!=="countries"&&view!=="imports"&&<label className="col-12 col-md-4">Pays
      <select className="form-select" value={country} onChange={e=>{setCountry(e.target.value);setPage(1);}}>
       <option value="">Tous les pays</option>{countries.map(c=>
        <option key={c.countryId} value={c.countryId}>{region(c.isoCode2)}</option>)}
      </select></label>}
     {view!=="imports"&&<label className="col-12 col-md-4">Statut
      <select className="form-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
       <option value="all">Tous</option><option value="active">Actifs</option>
       <option value="inactive">Inactifs</option>
       {view==="channels"&&<option value="review">À vérifier</option>}
      </select></label>}
    </div>
   </AdminFilterPanel>}
  {(view==="overview"||view==="statistics")&&!loading&&!error&&<>
   <AdminDataPanel label="Indicateurs disponibles">
    <div className="row g-3 p-3">
     <div className="col-6 col-lg-3"><strong>Pays actifs</strong><p className="fs-3">{countries.filter(c=>c.isActive).length}</p></div>
     <div className="col-6 col-lg-3"><strong>Chaînes activées</strong><p className="fs-3">{channels.filter(c=>c.isActive&&!c.needsReview&&countries.some(x=>x.countryId===c.countryId&&x.isActive)).length}</p></div>
     <div className="col-6 col-lg-3"><strong>Chaînes à vérifier</strong><p className="fs-3">{channels.filter(c=>c.needsReview).length}</p></div>
     <div className="col-6 col-lg-3"><strong>Dernier import</strong><p>{runs[0]?runs[0].status:"Aucun import connu"}</p></div>
    </div>
   </AdminDataPanel>
   <AdminDataPanel label="Qualité et provenance">
    <div className="p-3"><strong>Couverture EPG : non calculable</strong>
     <p>Les attestations de couverture vérifiables ne sont pas disponibles dans le modèle actuel.
      Aucun pourcentage ou indicateur de qualité n’est inventé.</p>
     <p>Sources sans approbation programmes : {new Set(sources.filter(s=>s.programmeRightsStatus!=="APPROVED").map(s=>s.id)).size}</p>
    </div>
   </AdminDataPanel>
  </>}
  {(view==="countries"||view==="channels"||view==="sources"||view==="imports")&&!loading&&!error&&
   <AdminDataPanel label={"Liste "+LABELS[view]}>
    <div className="table-responsive"><table className="table table-hover align-middle mb-0">
     <thead><tr>
      {view==="countries"&&<><th>Pays</th><th>Statut</th><th>Fuseau IANA</th><th>Chaînes actives / total</th><th>Couverture</th><th>Actions</th></>}
      {view==="channels"&&<><th>Chaîne</th><th>Pays</th><th>N°</th><th>Statut</th><th>Actions</th></>}
      {view==="sources"&&<><th>Source</th><th>Format</th><th>Pays / priorité</th><th>Droits programmes</th><th>Statut</th><th>Actions</th></>}
      {view==="imports"&&<><th>Date</th><th>Déclencheur</th><th>Jours</th><th>État</th><th>Périmètres</th><th>Actions</th></>}
     </tr></thead><tbody>
      {view==="countries"&&(visible as Country[]).map(v=><tr key={v.countryId}>
       <td>{region(v.isoCode2)} ({v.isoCode2})</td>
       <td>{v.isActive?"Actif":"Inactif"}</td><td>{v.referenceTimezone}</td>
       <td>{v.approvedChannelCount} / {v.channelCount}</td><td>Inconnue</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+region(v.isoCode2)} onClick={()=>setCountryEditor(v)}/></td>
      </tr>)}
      {view==="channels"&&(visible as Channel[]).map(v=><tr key={v.id}>
       <td>{v.name}</td><td>{region(countryCodes.get(v.countryId)??"")}</td>
       <td>{v.effectiveNumber??"—"}</td>
       <td>{v.needsReview?"À vérifier":v.isActive?"Active":"Inactive"}</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+v.name} onClick={()=>setChannelEditor(v)}/></td>
      </tr>)}
      {view==="sources"&&(visible as Source[]).map((v,i)=><tr key={v.id+":"+(v.countryId??i)}>
       <td>{v.name}</td><td>{v.format}</td>
       <td>{v.countryId?region(countryCodes.get(v.countryId)??""):"Non associée"} {v.priority??""}</td>
       <td>{v.programmeRightsStatus}</td><td>{v.isActive?"Active":"Inactive"}</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+v.name} onClick={()=>setSourceEditor(v)}/></td>
      </tr>)}
      {view==="imports"&&(visible as ImportRun[]).map(v=><tr key={v.id}>
       <td>{new Date(v.createdAt).toLocaleString("fr-FR")}</td>
       <td>{v.trigger}</td><td>{v.requestedDays}</td><td>{v.status}</td>
       <td>{v.succeeded} réussis / {v.failed} échoués / {v.scopeCount} au total</td>
       <td><AdminIconButton name="eye" label="Voir le détail" onClick={()=>void openRun(v.id)}/></td>
      </tr>)}
     </tbody></table></div>
    {filtered.length===0&&<p className="p-3 text-body-secondary">Aucune donnée correspondant aux filtres.</p>}
    <div className="p-3"><AdminPagination page={Math.min(page,pages)} totalPages={pages} onPageChange={setPage}
      label={LABELS[view]}/></div>
   </AdminDataPanel>}
  {view==="imports"&&selectedRun&&<AdminDataPanel label="Suivi de l'import">
   <div className="p-3">
    <h2 className="h5">Import {selectedRun}</h2>
    {detail?<><p>Statut : {detail.status}</p><ul>
     {detail.scopes.map(s=><li key={s.id}>{region(countryCodes.get(s.countryId)??"")} · {s.status}
       {s.errorMessage?" — "+s.errorMessage:""}</li>)}</ul>
     {["PARTIAL","ERROR","INTERRUPTED"].includes(detail.status)&&detail.scopes.some(s=>["ERROR","INTERRUPTED"].includes(s.status))&&
      <button type="button" className="btn btn-outline-primary" onClick={async()=>{
       try{const r=await request<{id:string}>("import-runs/"+detail.id+"/retry","POST",{});await openRun(r.id);
        setReload(v=>v+1);}catch(e){setError((e as Error).message);}
      }}>Relancer uniquement les échecs</button>}
     <h3 className="h6 mt-3">Journal d’événements</h3>
     <ul>{events.map(e=><li key={e.id}>{new Date(e.occurredAt).toLocaleString("fr-FR")} · {e.level} · {e.eventType} : {e.message}</li>)}</ul>
    </>:<p>Chargement…</p>}
   </div>
  </AdminDataPanel>}
  {view==="translations"&&!loading&&!error&&<TvTranslationPanel channels={channels}/>}
  {countryEditor&&<CountryEditor item={countryEditor} onClose={()=>setCountryEditor(null)} onSaved={saved}/>}
  {channelEditor&&<ChannelEditor item={channelEditor} onClose={()=>setChannelEditor(null)} onSaved={saved}/>}
  {sourceEditor&&<TvEpgSourceEditor item={sourceEditor} onClose={()=>setSourceEditor(null)} onSaved={saved}/>}
  {dialog==="source"&&<SourceEditor onClose={()=>setDialog(null)} onSaved={saved}/>}
  {dialog==="import"&&<ImportEditor countries={countries} onClose={()=>setDialog(null)}
   onSaved={id=>{saved();void openRun(id);setNotice("Import mis en file d’attente.");}}/>}
 </main>;
}
