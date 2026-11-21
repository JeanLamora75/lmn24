"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {mergeSocialDiscovery, SOCIAL_KEYS, SOCIAL_LABELS, type SocialKey, type SocialLinkValues} from "@/lib/source-social-discovery";
import {useRouter} from "next/navigation";
import {TvTranslationPanel} from "./TvTranslationPanel";
import {TvEpgSourceEditor} from "./TvEpgSourceEditor";
import {AdminPageHeading,AdminFilterPanel,AdminDataPanel} from "@/components/admin/AdminWorkspace";
import {AdminPagination} from "@/components/admin/AdminPagination";
import {AdminIconButton} from "@/components/admin/AdminIcon";
import {useAdminSessionFilter} from "@/lib/admin-session-filters";
import styles from "@/app/admin/(protected)/tv/tv-admin.module.css";
import {loadTvCountryNames,tvCountryName,type TvCountryNames} from "@/lib/tv-country-names";

export type TvView="overview"|"countries"|"channels"|"sources"|"imports"|"translations"|"statistics";
type Country={countryId:string;isoCode2:string;referenceTimezone:string;isActive:boolean;
 channelCount:number;approvedChannelCount:number;version:string};
type Channel={id:string;countryId:string;channelId:string;slug:string;name:string;
 logoUrl:string|null;websiteUrl:string|null;xUrl:string|null;facebookUrl:string|null;
 instagramUrl:string|null;youtubeUrl:string|null;officialLiveUrl:string|null;
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
type ExecutionReadiness={ready:boolean;mode:"DISCOVERY";missingFlags:string[];publicPublication:false};
const LABELS:Record<TvView,string>={
 overview:"Vue d'ensemble",countries:"Pays",channels:"Chaînes",
 sources:"Sources EPG",imports:"Imports",translations:"Traductions",statistics:"Statistiques",
};
const api="/api/admin/tv/";
const PAGE_SIZE=20;
const timezoneOptions=(()=>{try{return Intl.supportedValuesOf("timeZone");}
 catch{return ["Europe/Paris","Europe/London","America/New_York","Asia/Tokyo","UTC"];}})();
function region(iso:string,locale:string,countryNames:TvCountryNames){
 return tvCountryName(iso,locale,countryNames);
}
function messageFor(status:number):string{
 if(status===401)return "Votre session a expiré. Reconnectez-vous.";
 if(status===403)return "Accès réservé aux administrateurs.";
 if(status===409)return "Modification concurrente ou conflit : actualisez avant de réessayer.";
 if(status===503)return "Module TV indisponible : schéma ou fonctionnalité non activé.";
 return "Opération impossible. Vérifiez les données puis réessayez.";
}
async function request<T>(path:string,method="GET",payload?:unknown):Promise<T>{
 const response=await fetch(api+path,{method,cache:"no-store",
  headers:payload===undefined?{}:{"content-type":"application/json"},
  body:payload===undefined?null:JSON.stringify(payload)});
 if(!response.ok){
  let code="";
  try{
   const body=await response.json() as {message?:unknown};
   if(typeof body.message==="string")code=body.message;
  }catch{/* Proxy or upstream may return a non-JSON error. */}
  const reason=path==="import-runs"&&method==="POST"
   &&(code==="No enabled global EPG sources for requested countries"||code==="TV_NO_ACTIVE_EPG_SOURCE")
    ?"Aucune source EPG active pour ce pays. Activez une source qualifiée avant de lancer un import."
    :path==="import-runs"&&method==="POST"&&code==="TV_IMPORT_SCOPE_BUSY"
    ?"Un import est déjà en attente ou en cours pour ce pays."
    :messageFor(response.status)+" (HTTP "+response.status+").";
  throw Object.assign(new Error(reason),{status:response.status});
 }
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
function CountryEditor({item,locale,countryNames,onClose,onSaved}:{item:Country;locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:()=>void}){
 const [active,setActive]=useState(item.isActive);
 const [zone,setZone]=useState(item.referenceTimezone);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const options=timezoneOptions.includes(zone)?timezoneOptions:[zone,...timezoneOptions];
 return <Modal title={"Paramètres TV — "+region(item.isoCode2,locale,countryNames)} onClose={onClose}>
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
const channelUrlFields=[
 {key:"websiteUrl",label:"Site officiel"},
 {key:"logoUrl",label:"Logo officiel"},
 {key:"officialLiveUrl",label:"Diffusion en direct officielle"},
 {key:"facebookUrl",label:"Facebook"},
 {key:"instagramUrl",label:"Instagram"},
 {key:"youtubeUrl",label:"YouTube"},
 {key:"xUrl",label:"X / Twitter"},
] as const;
type ChannelUrlKey=(typeof channelUrlFields)[number]["key"];
type ChannelUrls=Record<ChannelUrlKey,string>;
function initialChannelUrls(item?:Channel):ChannelUrls{
 return Object.fromEntries(channelUrlFields.map(({key})=>[key,item?.[key]??""])) as ChannelUrls;
}
function ChannelUrlInputs({values,onChange}:{values:ChannelUrls;onChange:(next:ChannelUrls)=>void}){
 const [discovering,setDiscovering]=useState(false);
 const [notice,setNotice]=useState("");
 const [conflicts,setConflicts]=useState<Partial<SocialLinkValues>>({});
 const latest=useRef(values);
 useEffect(()=>{latest.current=values;},[values]);
 const router=useRouter();
 async function discover(){
  if(discovering)return;
  const websiteUrl=latest.current.websiteUrl.trim();
  if(!websiteUrl){
   setNotice("Renseignez d’abord l’URL du site officiel.");
   return;
  }
  try{
   const url=new URL(websiteUrl);
   if(!["https:","http:"].includes(url.protocol))throw new Error();
  }catch{
   setNotice("Renseignez une URL HTTP ou HTTPS valide.");
   return;
  }
  setDiscovering(true);setNotice("");setConflicts({});
  try{
   const response=await fetch("/api/admin/sources/social-links/discover",{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({websiteUrl}),
   });
   if(response.status===401){router.replace("/admin/login");return;}
   if(!response.ok){
    const body=await response.json().catch(()=>null) as {message?:string|string[]}|null;
    throw new Error(typeof body?.message==="string"?body.message:
     "Impossible de rechercher les réseaux sociaux sur ce site.");
   }
   const raw=await response.json() as Partial<Record<SocialKey,unknown>>;
   const discovered={} as SocialLinkValues;
   for(const key of SOCIAL_KEYS){
    const value=raw[key];
    if(value!==null&&value!==undefined&&typeof value!=="string")
     throw new Error("Réponse de découverte invalide.");
    discovered[key]=typeof value==="string"?value:null;
   }
   if(latest.current.websiteUrl.trim()!==websiteUrl){
    setNotice("L’URL du site a changé : relancez la recherche.");
    return;
   }
   const current=latest.current;
   const previous=Object.fromEntries(SOCIAL_KEYS.map(key=>[key,current[key]||null])) as SocialLinkValues;
   const result=mergeSocialDiscovery(previous,discovered);
   onChange({...current,...Object.fromEntries(SOCIAL_KEYS.map(key=>[key,result.next[key]??""]))});
   setConflicts(result.conflicts);
   setNotice(result.found===0?"Aucun réseau social trouvé sur ce site.":
    result.added+" lien(s) ajouté(s), "+Object.keys(result.conflicts).length+
    " conflit(s). Les liens existants ont été conservés.");
  }catch(error){
   setNotice(error instanceof Error?error.message:"La recherche des réseaux sociaux a échoué.");
  }finally{setDiscovering(false);}
 }
 return <fieldset className="mt-3"><legend className="fs-6 fw-bold">Liens officiels et réseaux sociaux</legend>
  <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
   <button type="button" className="btn btn-outline-primary" disabled={discovering}
    onClick={()=>void discover()}>{discovering?"Recherche en cours…":"Réseaux sociaux"}</button>
   <span className="small text-body-secondary">Recherche les comptes officiels à partir du site renseigné, sans enregistrement automatique.</span>
  </div>
  {notice&&<p role="status" className="alert alert-info">{notice}</p>}
  {SOCIAL_KEYS.some(key=>Boolean(conflicts[key]))&&<div className="alert alert-warning">
   <p>Des liens sont déjà renseignés. Choisissez ceux à remplacer :</p>
   {SOCIAL_KEYS.filter(key=>Boolean(conflicts[key])).map(key=><div key={key} className="mb-2">
    <span>{SOCIAL_LABELS[key]} : {conflicts[key]}</span>{" "}
    <button type="button" className="btn btn-sm btn-outline-primary" onClick={()=>{
     const value=conflicts[key];if(!value)return;
     onChange({...latest.current,[key]:value});
     setConflicts(previous=>{const next={...previous};delete next[key];return next;});
    }}>Remplacer</button>
   </div>)}
  </div>}
  <div className="row g-3">
   {channelUrlFields.map(({key,label})=><label key={key} className="col-12 col-md-6">{label}
    <input type="url" className="form-control" maxLength={2048} value={values[key]}
     placeholder="https://" onChange={e=>onChange({...values,[key]:e.target.value})}/>
   </label>)}
  </div>
 </fieldset>;
}
function channelUrlPayload(values:ChannelUrls){
 return Object.fromEntries(channelUrlFields.map(({key})=>[key,values[key].trim()||null]));
}
function ChannelCreateEditor({countries,locale,countryNames,onClose,onSaved}:{countries:Country[];locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:()=>void}){
 const [countryId,setCountryId]=useState(countries[0]?.countryId??"");
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [urls,setUrls]=useState<ChannelUrls>(()=>initialChannelUrls());
 const [number,setNumber]=useState("");
 const [active,setActive]=useState(false);
 const [review,setReview]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 return <Modal title="Ajouter une chaîne TV" onClose={onClose}>
  <form onSubmit={async e=>{
   e.preventDefault();if(busy)return;
   setBusy(true);setError("");
   try{
    const n=number.trim()===""?null:Number(number);
    if(n!==null&&(!Number.isInteger(n)||n<1||n>2147483647))throw new Error("Numéro national invalide.");
    if(active&&n===null)throw new Error("Une chaîne active nécessite un numéro national.");
    const created=await request<{discoveredAssociations:{id:string}[]}>("catalog/channels/discover","POST",{
     countryId,slug:slug.trim(),name:name.trim(),...channelUrlPayload(urls),
    });
    const association=created.discoveredAssociations[0];
    if(association&&(n!==null||active||!review)){
     await request("catalog/associations/"+association.id,"PATCH",{
      isActive:active,needsReview:review,manualNumber:n,
      officialNumber:null,assignedNumber:null,defaultVariantId:null,
     });
    }
    onSaved();
   }catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
   <label className="form-label" htmlFor="tv-create-country">Pays</label>
   <select id="tv-create-country" className="form-select mb-3" value={countryId}
    required onChange={e=>setCountryId(e.target.value)}>
    {countries.map(c=><option key={c.countryId} value={c.countryId}>{region(c.isoCode2,locale,countryNames)}</option>)}
   </select>
   <label className="form-label" htmlFor="tv-create-name">Nom de la chaîne</label>
   <input id="tv-create-name" className="form-control mb-3" required maxLength={255}
    value={name} onChange={e=>setName(e.target.value)}/>
   <label className="form-label" htmlFor="tv-create-slug">Identifiant (slug)</label>
   <input id="tv-create-slug" className="form-control mb-3" required maxLength={255}
    pattern="[a-z0-9][a-z0-9-]*" placeholder="exemple-tv"
    value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/>
   <label className="form-label" htmlFor="tv-create-number">Numéro national manuel (facultatif)</label>
   <input id="tv-create-number" type="number" min={1} className="form-control mb-3"
    value={number} onChange={e=>setNumber(e.target.value)}/>
   <label className="form-check mb-2"><input type="checkbox" className="form-check-input"
    checked={active} onChange={e=>setActive(e.target.checked)}/>
    <span className="form-check-label">Active dans ce pays</span></label>
   <label className="form-check mb-3"><input type="checkbox" className="form-check-input"
    checked={review} onChange={e=>setReview(e.target.checked)}/>
    <span className="form-check-label">À vérifier (masquée du public)</span></label>
   <ChannelUrlInputs values={urls} onChange={setUrls}/>
   <p className="text-body-secondary mt-3">Une chaîne nouvelle est inactive et à vérifier par défaut.</p>
   {countries.length===0&&<p className="alert alert-warning">Configurez d&apos;abord un pays dans l&apos;onglet Pays.</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex justify-content-end gap-2">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
    <button type="submit" className="btn btn-primary" disabled={busy||countries.length===0||!countryId}>Créer la chaîne</button>
   </div>
  </form>
 </Modal>;
}
function ChannelEditor({item,onClose,onSaved}:{item:Channel;onClose:()=>void;onSaved:()=>void}){
 const [name,setName]=useState(item.name);
 const [urls,setUrls]=useState<ChannelUrls>(()=>initialChannelUrls(item));
 const [number,setNumber]=useState(item.manualNumber===null?"":String(item.manualNumber));
 const [active,setActive]=useState(item.isActive);
 const [review,setReview]=useState(item.needsReview);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 return <Modal title={"Modifier la chaîne — "+item.name} onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");
   const n=number.trim()===""?null:Number(number);
   if(n!==null&&(!Number.isInteger(n)||n<1||n>2147483647)){
    setError("Numéro national invalide.");setBusy(false);return;
   }
   try{
    await request("catalog/channels/"+item.channelId+"/profile","PATCH",{
     name:name.trim(),...channelUrlPayload(urls),
    });
    await request("catalog/associations/"+item.id,"PATCH",{
     isActive:active,needsReview:review,manualNumber:n,
     officialNumber:item.officialNumber,assignedNumber:item.assignedNumber,
     defaultVariantId:item.defaultVariantId,expectedVersion:item.version,
    });
    onSaved();
   }catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
   <label htmlFor="tv-channel-name" className="form-label">Nom de la chaîne</label>
   <input id="tv-channel-name" className="form-control mb-3" required maxLength={255}
    value={name} onChange={e=>setName(e.target.value)}/>
   <p className="text-body-secondary">Numéro actuel : {item.effectiveNumber??"Non attribué"}.
    La correction manuelle prime sur les numéros importés.</p>
   <label htmlFor="tv-manual-number" className="form-label">Numéro national manuel</label>
   <input id="tv-manual-number" type="number" min={1} className="form-control mb-3"
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
   <ChannelUrlInputs values={urls} onChange={setUrls}/>
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end mt-3">
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
    <p className="small text-body-secondary">Aucun justificatif n&apos;est requis pour enregistrer votre décision. La republication demeure soumise à des contrôles distincts.</p>
    {rights.map(key=><div key={key} className="mb-2">
     <label className="form-label text-capitalize" htmlFor={"rights-"+key}>{key==="programme"?"Programmes":key==="synopsis"?"Synopsis":key==="image"?"Images":"Logos"}</label>
     <select id={"rights-"+key} className="form-select" value={rightsData[key].status}
      onChange={e=>setRightsData(old=>({...old,[key]:{...old[key],status:e.target.value}}))}>
      {[{value:"UNREVIEWED",label:"À vérifier"},{value:"APPROVED",label:"Autorisé"},{value:"REJECTED",label:"Non autorisé"},{value:"EXPIRED",label:"Expiré"}].map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
     </select>
    </div>)}
   </fieldset>
   {error&&<p className="alert alert-danger" role="alert">{error}</p>}
   <div className="d-flex justify-content-end gap-2">
    <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Annuler</button>
    <button className="btn btn-primary" disabled={busy} type="submit">Créer</button>
   </div>
  </form>
 </Modal>;
}
function ImportEditor({countries,locale,countryNames,onClose,onSaved}:{countries:Country[];locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:(id:string)=>void}){
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
     {region(x.isoCode2,locale,countryNames)}{x.isActive?"":" (inactif)"}</option>)}
   </select>
   <label className="form-label" htmlFor="tv-import-days">Nombre de jours</label>
   <select id="tv-import-days" className="form-select mb-3" value={days}
    onChange={e=>setDays(Number(e.target.value))}>
    {[1,2,3,4,5,6,7].map(x=><option key={x} value={x}>{x}</option>)}
   </select>
   <p className="text-body-secondary">{eligible.length} pays concernés.
    L’import manuel d’un pays inactif est autorisé. Toutes les sources EPG actives
    sont prises en compte sans rattachement préalable aux pays ; les droits sont
    vérifiés avant toute publication et les correspondances inconnues restent à valider.</p>
   {eligible.length===0&&<p className="alert alert-warning">Aucun pays éligible.</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
    <button type="submit" disabled={busy||eligible.length===0} className="btn btn-primary">Lancer l&apos;import</button>
   </div>
  </form>
 </Modal>;
}

export function TvAdminWorkspace({view}:{view:TvView}){
 const router=useRouter();
 const [locale,setLocale]=useState("fr");
 const [countryNames,setCountryNames]=useState<TvCountryNames>({});
 useEffect(()=>{
  const syncLocale=()=>setLocale(document.documentElement.lang||"fr");
  syncLocale();
  const observer=new MutationObserver(syncLocale);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let current=true;
  // Locale changes can race: never apply a previous dictionary to the new locale.
  void loadTvCountryNames(locale).then(names=>{
   if(current)setCountryNames(names);
  }).catch(()=>{if(current)setCountryNames({});});
  return ()=>{current=false;};
 },[locale]);
 const [countries,setCountries]=useState<Country[]>([]);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [sources,setSources]=useState<Source[]>([]);
 const [runs,setRuns]=useState<ImportRun[]>([]);
 const [detail,setDetail]=useState<ImportDetail|null>(null);
 const [events,setEvents]=useState<ImportEvent[]>([]);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);const [reload,setReload]=useState(0);
 const [dialog,setDialog]=useState<"source"|"import"|"channel"|null>(null);
 const [countryEditor,setCountryEditor]=useState<Country|null>(null);
 const [channelEditor,setChannelEditor]=useState<Channel|null>(null);
 const [sourceEditor,setSourceEditor]=useState<Source|null>(null);
 const [filter,setFilter]=useAdminSessionFilter("tv-"+view,"search","");
 const [country,setCountry]=useAdminSessionFilter("tv-"+view,"country","");
 const [status,setStatus]=useAdminSessionFilter("tv-"+view,"status","all");
 const [page,setPage]=useAdminSessionFilter("tv-"+view,"page",1);
 const [selectedRun,setSelectedRun]=useState("");
 const [executionState,setExecutionState]=useState<ExecutionReadiness|null>(null);
 const [executing,setExecuting]=useState(false);
 useEffect(()=>{
  if(view!=="imports")return;
  let current=true;
  void request<ExecutionReadiness>("import-runs/execution-status").then(value=>{
   if(current)setExecutionState(value);
  }).catch(()=>{if(current)setExecutionState(null);});
  return ()=>{current=false;};
 },[view,reload]);
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
 async function executeRun(id:string){
  if(executing)return;
  setExecuting(true);setError("");setNotice("");
  try{
   await request("import-runs/"+id+"/execute","POST",{mode:"DISCOVERY"});
   setNotice("Découverte demandée. Seuls les identifiants externes seront collectés, sans publier de programmes.");
   await openRun(id);
   setReload(v=>v+1);
  }catch(err){setError((err as Error).message);}
  finally{setExecuting(false);}
 }
 // Refresh the run and event history while a dispatched worker is active.
 // Unlike the queue creation endpoint, this is read-only polling.
 useEffect(()=>{
  if(view!=="imports"||!selectedRun||!executionState?.ready
    ||(detail?.status!=="QUEUED"&&detail?.status!=="RUNNING"))return;
  let mounted=true;
  const interval=setInterval(()=>{
   void Promise.all([
    request<ImportDetail>("import-runs/"+selectedRun),
    request<{items:ImportEvent[]}>("import-runs/"+selectedRun+"/events"),
    request<{items:ImportRun[]}>("import-runs?page=1&pageSize=100"),
   ]).then(([d,e,list])=>{
    if(!mounted)return;
    setDetail(d);setEvents(e.items);setRuns(list.items);
   }).catch(()=>{/* Manual reload remains available; never falsify success. */});
  },5000);
  return ()=>{mounted=false;clearInterval(interval);};
 },[view,selectedRun,executionState?.ready,detail?.status]);
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
 const action=view==="channels"?<button className="btn btn-primary" type="button" onClick={()=>setDialog("channel")}>Ajouter une chaîne</button>
   :view==="sources"?<button className="btn btn-primary" type="button" onClick={()=>setDialog("source")}>Ajouter une source EPG</button>
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
     {view==="channels"&&<label className="col-12 col-md-4">Pays
      <select className="form-select" value={country} onChange={e=>{setCountry(e.target.value);setPage(1);}}>
       <option value="">Tous les pays</option>{countries.map(c=>
        <option key={c.countryId} value={c.countryId}>{region(c.isoCode2,locale,countryNames)}</option>)}
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
  {view==="sources"&&<p className="text-body-secondary">L&apos;activation d&apos;une source EPG s&apos;applique à tout son flux, sans rattachement obligatoire à un pays. Les pays et chaînes inconnus restent à vérifier avant publication.</p>}
   {(view==="countries"||view==="channels"||view==="sources"||view==="imports")&&!loading&&!error&&
   <AdminDataPanel label={"Liste "+LABELS[view]}>
    <div className="table-responsive"><table className="table table-hover align-middle mb-0">
     <thead><tr>
      {view==="countries"&&<><th>Pays</th><th>Statut</th><th>Fuseau IANA</th><th>Chaînes actives / total</th><th>Couverture</th><th>Actions</th></>}
      {view==="channels"&&<><th>Chaîne</th><th>Pays</th><th>N°</th><th>Statut</th><th>Actions</th></>}
      {view==="sources"&&<><th>Source</th><th>Format</th><th>Périmètre</th><th>Droits programmes</th><th>Statut</th><th>Actions</th></>}
      {view==="imports"&&<><th>Date</th><th>Déclencheur</th><th>Jours</th><th>État</th><th>Périmètres</th><th>Actions</th></>}
     </tr></thead><tbody>
      {view==="countries"&&(visible as Country[]).map(v=><tr key={v.countryId}>
       <td>{region(v.isoCode2,locale,countryNames)} ({v.isoCode2})</td>
       <td>{v.isActive?"Actif":"Inactif"}</td><td>{v.referenceTimezone}</td>
       <td>{v.approvedChannelCount} / {v.channelCount}</td><td>Inconnue</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+region(v.isoCode2,locale,countryNames)} onClick={()=>setCountryEditor(v)}/></td>
      </tr>)}
      {view==="channels"&&(visible as Channel[]).map(v=><tr key={v.id}>
       <td>{v.name}</td><td>{region(countryCodes.get(v.countryId)??"",locale,countryNames)}</td>
       <td>{v.effectiveNumber??"—"}</td>
       <td>{v.needsReview?"À vérifier":v.isActive?"Active":"Inactive"}</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+v.name} onClick={()=>setChannelEditor(v)}/></td>
      </tr>)}
      {view==="sources"&&(visible as Source[]).map((v,i)=><tr key={v.id+":"+(v.countryId??i)}>
       <td>{v.name}</td><td>{v.format}</td>
       <td>{v.countryId?("Exception : "+region(countryCodes.get(v.countryId)??"",locale,countryNames)+(v.priority?" · priorité "+v.priority:"")):"Globale"}</td>
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
  {view==="imports"&&!loading&&!error&&<AdminDataPanel label="Exécution du worker EPG">
   <div className="p-3">
    <p>La mise en file d&apos;attente et l&apos;exécution sont séparées. Le mode découverte
     analyse uniquement les identifiants de chaînes externes, sans publier de programmes.</p>
    {executionState?.ready
     ?<p className="text-success">Exécution de découverte autorisée par la configuration serveur.</p>
     :<p className="text-body-secondary">Exécution externe bloquée tant que les autorisations
      opérationnelles ne sont pas validées. Le clic sur un import ne télécharge aucun flux.
      {executionState?.missingFlags.length? " Paramètres à qualifier : "+executionState.missingFlags.join(", "):""}</p>}
   </div>
  </AdminDataPanel>}
  {view==="imports"&&selectedRun&&<AdminDataPanel label="Suivi de l'import">
   <div className="p-3">
    <h2 className="h5">Import {selectedRun}</h2>
    {detail?<><p>Statut : {detail.status}</p>
     {detail.status==="QUEUED"&&<div className="mb-3">
      <button type="button" className="btn btn-primary" disabled={executing||!executionState?.ready}
       onClick={()=>void executeRun(detail.id)}>Exécuter la découverte des chaînes</button>
      {!executionState?.ready&&<p className="small text-body-secondary mt-2">Action désactivée : les validations serveur nécessaires à la collecte ne sont pas réunies.</p>}
     </div>}<ul>
     {detail.scopes.map(s=><li key={s.id}>{region(countryCodes.get(s.countryId)??"",locale,countryNames)} · {s.status}
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
  {countryEditor&&<CountryEditor item={countryEditor} locale={locale} countryNames={countryNames} onClose={()=>setCountryEditor(null)} onSaved={saved}/>}
  {channelEditor&&<ChannelEditor item={channelEditor} onClose={()=>setChannelEditor(null)} onSaved={saved}/>}
  {sourceEditor&&<TvEpgSourceEditor item={sourceEditor} onClose={()=>setSourceEditor(null)} onSaved={saved}/>}
  {dialog==="channel"&&<ChannelCreateEditor countries={countries} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)} onSaved={saved}/>}
   {dialog==="source"&&<SourceEditor onClose={()=>setDialog(null)} onSaved={saved}/>}
  {dialog==="import"&&<ImportEditor countries={countries} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)}
   onSaved={id=>{saved();void openRun(id);setNotice("Import mis en file d’attente.");}}/>}
 </main>;
}
