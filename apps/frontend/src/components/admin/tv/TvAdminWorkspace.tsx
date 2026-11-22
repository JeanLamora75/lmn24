"use client";
import {Fragment,useEffect,useMemo,useRef,useState} from "react";
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
import {TvSortableHeader,sortTvRows,nextTvSort,type TvSortState} from "./TvSortableHeader";
import {groupTvChannels,tvChannelDisplayKey} from "./tv-channel-grouping";

export type TvView="overview"|"countries"|"channels"|"sources"|"imports"|"translations"|"statistics"|"associations";
type Country={countryId:string;isoCode2:string;referenceTimezone:string;isActive:boolean;
 channelCount:number;approvedChannelCount:number;version:string};
type Channel={id:string;countryId:string;channelId:string;slug:string;name:string;
 logoUrl:string|null;websiteUrl:string|null;xUrl:string|null;facebookUrl:string|null;
 instagramUrl:string|null;youtubeUrl:string|null;officialLiveUrl:string|null;
 isActive:boolean;needsReview:boolean;effectiveNumber:number|null;manualNumber:number|null;
 officialNumber:number|null;assignedNumber:number|null;defaultVariantId:string|null;version:string};
type Source={id:string;name:string;sourceUrl:string;format:string;isActive:boolean;version:string;
 geographicScope:"GLOBAL"|"COUNTRY";scopeCountryId:string|null;
 programmeRightsStatus:string;programmeRightsReference:string|null;
 synopsisRightsStatus:string;synopsisRightsReference:string|null;imageRightsStatus:string;
 imageRightsReference:string|null;logoRightsStatus:string;logoRightsReference:string|null;
 countryId:string|null;priority:number|null;lastImportStatus:string|null};
type ImportRun={id:string;trigger:string;requestedDays:number;status:string;createdAt:string;
 scopeCount:number;succeeded:number;failed:number};
type ImportDetail=ImportRun&{scopes:{id:string;countryId:string;sourceId:string|null;sourceName?:string|null;
 status:string;attempts:number;errorMessage:string|null}[];
 privateDrafts?:{draftDays:number;draftAirings:number;draftProgrammes:number}};
type ImportEvent={id:string;scopeId?:string|null;occurredAt:string;eventType:string;level:string;message:string};
const failureMessages:Record<string,string>={
 EPG_HTTP_404:"Téléchargement · HTTP 404 : fichier absent. Vérifier que la source pointe vers un fichier EPG actuel.",
 EPG_HTTP_403:"Téléchargement · HTTP 403 : accès refusé. Vérifier les autorisations ou restrictions du fournisseur.",
 EPG_HTTP_429:"Téléchargement · HTTP 429 : trop de requêtes. Espacer les imports.",
 EPG_HTTP_5XX:"Téléchargement · HTTP 5xx : erreur du fournisseur. Réessayer après rétablissement.",
 EPG_HTTP_REDIRECT:"Téléchargement · redirection HTTP interdite par sécurité. Enregistrer l'URL finale approuvée.",
 EPG_HTTP_ERROR:"Téléchargement · réponse HTTP inattendue. Vérifier la disponibilité du fichier chez le fournisseur.",
 EPG_DNS_ERROR:"Réseau/DNS · nom de domaine introuvable ou résolution impossible. Vérifier DNS et connexion du backend.",
 EPG_DNS_NON_PUBLIC:"Réseau/DNS · adresse IP non publique ou IPv6 sans IPv4 publique. Source rejetée pour sécurité SSRF.",
 EPG_URL_INVALID:"Configuration · URL EPG invalide ou non autorisée. Vérifier protocole HTTPS/HTTP, hôte et port.",
 EPG_TIMEOUT:"Téléchargement · délai de 30 secondes dépassé. Vérifier le débit, la disponibilité du fournisseur et le réseau serveur.",
 EPG_SIZE_LIMIT:"Taille · limite technique dépassée. Contrôler le fichier téléchargé et le XML extrait.",
 EPG_SIZE_COMPRESSED:"Taille · archive téléchargée supérieure à 24 Mio. Choisir un flux plus petit.",
 EPG_SIZE_EXPANDED:"Taille · document décompressé supérieur à 96 Mio. Choisir un flux moins volumineux.",
 EPG_PROGRAMME_LIMIT:"Décodage · plus de 250 000 émissions dans le fichier XMLTV. Choisir un flux régional ou fractionné.",
 EPG_XMLTV_INVALID:"Décodage · XMLTV malformé, encodage invalide ou structure non prise en charge. Vérifier le XML extrait.",
 EPG_XMLTV_TIME_INVALID:"Décodage · date/horaire d'émission invalide ou fuseau horaire absent. Vérifier les attributs start/stop du XMLTV.",
 EPG_XMLTV_ITEM_INVALID:"Décodage · émission incomplète : chaîne, titre ou horaires manquants. Vérifier les balises programme.",
 EPG_FORMAT_MISMATCH:"Décodage · le contenu ne correspond pas au format configuré (XMLTV, GZIP ou JSON). Vérifier la source.",
 EPG_NO_PROGRAMMES:"Décodage · aucune émission exploitable trouvée. Vérifier la période et le contenu de la source.",
 EPG_DATABASE_WRITE:"Base de données · échec pendant la découverte ou l'enregistrement des chaînes. Vérifier PostgreSQL et les migrations.",
 EPG_TLS_ERROR:"TLS/HTTPS · certificat ou négociation sécurisée refusé(e). Vérifier la chaîne de certificats du serveur distant.",
 EPG_CONNECTION_ERROR:"Réseau · connexion refusée, réinitialisée ou inaccessible. Vérifier pare-feu, proxy et serveur fournisseur.",
 EPG_CONNECTION_RESET:"Réseau · connexion réinitialisée pendant la requête, même après nouvelles tentatives. Vérifier stabilité du serveur EPG et du réseau.",
 EPG_CONNECTION_REFUSED:"Réseau · connexion refusée par l’hôte distant, même après nouvelles tentatives. Vérifier serveur, port et pare-feu.",
 EPG_CONNECTION_UNREACHABLE:"Réseau · serveur ou réseau inaccessible, même après nouvelles tentatives. Vérifier routage et connexion du backend.",
 EPG_STREAM_INTERRUPTED:"Téléchargement · flux interrompu avant la fin. Vérifier connexion réseau et stabilité du fournisseur.",
 EPG_GZIP_INVALID:"Décompression · fichier GZIP incomplet, corrompu ou incompatible avec le format de la source.",
 EPG_CONTENT_ENCODING_INVALID:"Téléchargement · compression HTTP inattendue. Le fournisseur doit renvoyer un contenu compatible.",
 EPG_DNS_LOOKUP_FAILED:"Étape DNS · échec inattendu lors de la résolution du domaine. Vérifier DNS du PC, proxy et accès Internet depuis le backend.",
 EPG_HTTP_REQUEST_FAILED:"Étape HTTP/HTTPS · impossible d'établir ou exécuter la requête. Vérifier proxy, certificat système et connexion du processus backend.",
 EPG_HTTP_TRANSFER_FAILED:"Étape transfert HTTP · la réponse a été interrompue avant la fin du fichier. Vérifier réseau et stabilité du fournisseur.",
 EPG_GZIP_PROCESS_FAILED:"Étape décompression GZIP · une erreur interne empêche l'extraction du fichier. Vérifier l'archive et le format déclaré.",
 EPG_DOWNLOAD_UNEXPECTED:"Téléchargement · erreur non reconnue par le backend. Consulter le diagnostic technique du serveur (aucun détail brut n'est exposé).",
 EPG_DECODE_UNEXPECTED:"Décodage · erreur interne non reconnue. Vérifier les journaux techniques du backend.",
 EPG_SOURCE_UNAVAILABLE:"Source EPG indisponible · aucune cause technique n'a été conservée. Vérifier que le backend exécute la version actuelle.",
};
function importDiagnostic(value:string):string{
 const explanation=failureMessages[value];
 return explanation?explanation+" [Code : "+value+"]":value;
}
const LABELS:Record<TvView,string>={
 overview:"Vue d'ensemble",countries:"Pays",channels:"Chaînes",associations:"Associations EPG",
 sources:"Sources EPG",imports:"Imports",translations:"Traductions",statistics:"Statistiques",
};
const api="/api/admin/tv/";
const DEFAULT_PAGE_SIZE=25;
const CHANNEL_PAGE_SIZES=[10,25,50,100,150] as const;
const CHANNEL_PAGE_SIZE_STORAGE_KEY="lmn24:admin:tv:channels:page-size";
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
  const reason=path==="import-runs"&&method==="POST"&&response.status===503
    ?"La collecte de cette source n’est pas encore autorisée sur le serveur. Aucun import n’a été démarré."
    :path==="import-runs"&&method==="POST"
   &&(code==="No enabled global EPG sources for requested countries"||code==="TV_NO_ACTIVE_EPG_SOURCE")
    ?"Aucune source EPG active pour ce pays. Activez une source qualifiée avant de lancer un import."
    :path==="import-runs"&&method==="POST"&&code==="TV_IMPORT_SCOPE_BUSY"
    ?"Un import est déjà en attente ou en cours pour ce pays."
    :path.includes("/icon/import")&&code
    ?code
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
function ChannelUrlInputs({values,onChange,hideLogo=false}:{values:ChannelUrls;onChange:(next:ChannelUrls)=>void;hideLogo?:boolean}){
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
   {channelUrlFields.filter(({key})=>!hideLogo||key!=="logoUrl").map(({key,label})=><label key={key} className="col-12 col-md-6">{label}
    <input type="url" className="form-control" maxLength={2048} value={values[key]}
     placeholder="https://" onChange={e=>onChange({...values,[key]:e.target.value})}/>
   </label>)}
  </div>
 </fieldset>;
}
function channelUrlPayload(values:ChannelUrls){
 return Object.fromEntries(channelUrlFields.map(({key})=>[key,values[key].trim()||null]));
}
async function uploadTvChannelIcon(channelId:string,file:File):Promise<string>{
 if(file.size===0||file.size>1_000_000)throw new Error("Le logo doit faire moins de 1 Mo.");
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))
  throw new Error("Format de logo accepté : PNG, JPEG ou WebP.");
 const base64=await new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(",")[1]??"");
  reader.onerror=()=>reject(new Error("Impossible de lire le logo."));
  reader.readAsDataURL(file);
 });
 const result=await request<{logoUrl:string}>("catalog/channels/"+channelId+"/icon","POST",{base64});
 return result.logoUrl;
}
function ChannelLogoField({url,file,onFile}:{url:string;file:File|null;
 onFile:(value:File|null)=>void}){
 return <div className="mb-3">
  <label className="form-label" htmlFor="tv-channel-logo-upload">Logo de la chaîne</label>
  {url&&<div className="mb-2 d-flex align-items-center gap-2">
   <img src={url} width={90} height={54} alt="Logo actuel"
    style={{objectFit:"contain"}}/>
   <small className="text-body-secondary">Logo actuel {url.startsWith("/tv-icons/")?"(local)":"(URL externe)"}</small>
  </div>}
  <input className="form-control" id="tv-channel-logo-upload" type="file"
   accept="image/png,image/jpeg,image/webp"
   onChange={e=>onFile(e.target.files?.[0]??null)}/>
  <small className="text-body-secondary">PNG, JPEG ou WebP · 1 Mo maximum.
   {file?" Nouveau logo : "+file.name:""}
  </small>
 </div>;
}
function ChannelCreateEditor({countries,locale,countryNames,onClose,onSaved}:{countries:Country[];locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:()=>void}){
 const [countryId,setCountryId]=useState(countries[0]?.countryId??"");
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [urls,setUrls]=useState<ChannelUrls>(()=>initialChannelUrls());
 const [logoFile,setLogoFile]=useState<File|null>(null);
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
 
    const created=await request<{channelId:string;discoveredAssociations:{id:string}[]}>(
     "catalog/channels/discover","POST",{
      countryId,slug:slug.trim(),name:name.trim(),...channelUrlPayload(urls),
    });
    const association=created.discoveredAssociations[0];
    if(association){
     // A broadcast variant is required before verified EPG mappings can
     // produce programmes. Use the country's configured IANA timezone.
     const zone=countries.find(c=>c.countryId===countryId)?.referenceTimezone;
     if(!zone)throw new Error("Fuseau du pays indisponible : configurez d’abord ce pays.");
     const variant=await request<{variantId:string}>("catalog/variants","POST",{
      channelId:created.channelId,channelCountryId:association.id,
      code:"main-"+(countries.find(c=>c.countryId===countryId)?.isoCode2.toLowerCase()??"tv"),
      name:name.trim(),timezone:zone,
     });
     if(n!==null||active||!review){
      await request("catalog/associations/"+association.id,"PATCH",{
       isActive:active,needsReview:review,manualNumber:n,
       officialNumber:null,assignedNumber:null,defaultVariantId:variant.variantId,
      });
     }
    }
    if(logoFile)await uploadTvChannelIcon(created.channelId,logoFile);
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
   <ChannelLogoField url={urls.logoUrl} file={logoFile} onFile={setLogoFile}/>
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
function ChannelEditor({item,onClose,onSaved,page=false}:{item:Channel;onClose:()=>void;onSaved:()=>void;page?:boolean}){
 const [name,setName]=useState(item.name);
 const [urls,setUrls]=useState<ChannelUrls>(()=>initialChannelUrls(item));
 const [logoFile,setLogoFile]=useState<File|null>(null);
 const [logoMode,setLogoMode]=useState<"file"|"url">("file");
 const [remoteLogo,setRemoteLogo]=useState("");
 const [logoRemoved,setLogoRemoved]=useState(false);
 const [number,setNumber]=useState(item.manualNumber===null?"":String(item.manualNumber));
 const [active,setActive]=useState(item.isActive);
 const [review,setReview]=useState(item.needsReview);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const form=<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");
   const n=number.trim()===""?null:Number(number);
   if(n!==null&&(!Number.isInteger(n)||n<1||n>2147483647)){
    setError("Numéro national invalide.");setBusy(false);return;
   }
   try{
    const logoUrl=logoRemoved?"":logoMode==="file"&&logoFile
     ?await uploadTvChannelIcon(item.channelId,logoFile)
     :logoMode==="url"&&remoteLogo.trim()
      ?(await request<{logoUrl:string}>("catalog/channels/"+item.channelId+"/icon/import","POST",{url:remoteLogo.trim()})).logoUrl
      :urls.logoUrl.trim()||null;
    await request("catalog/channels/"+item.channelId+"/profile","PATCH",{
     name:name.trim(),...channelUrlPayload(urls),logoUrl,
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
   <fieldset className="border rounded p-3 mb-3">
    <legend className="fs-6 float-none w-auto px-2">Source de l’image</legend>
    {urls.logoUrl&&!logoRemoved&&<div className="mb-3 d-flex flex-wrap align-items-center gap-3">
     <img src={urls.logoUrl} width={110} height={70}
      alt={"Logo actuel de "+name} style={{objectFit:"contain",background:"#17263d",borderRadius:6}}/>
     <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy}
      onClick={()=>{
       if(!window.confirm("Supprimer le logo de cette chaîne ? La suppression sera enregistrée avec le formulaire."))return;
       setLogoRemoved(true);setLogoFile(null);setRemoteLogo("");
       setUrls(previous=>({...previous,logoUrl:""}));
      }}>Supprimer le logo</button>
    </div>}
    {logoRemoved&&<p role="status" className="text-body-secondary small">
     Logo retiré. L’emplacement restera vide après enregistrement, y compris lors des prochains imports EPG.
    </p>}
    <div className="d-flex flex-wrap gap-3 mb-3">
     <label><input type="radio" name="tv-logo-source" checked={logoMode==="file"}
      onChange={()=>setLogoMode("file")}/> Fichier local</label>
     <label><input type="radio" name="tv-logo-source" checked={logoMode==="url"}
      onChange={()=>setLogoMode("url")}/> Importer depuis une URL</label>
    </div>
    {logoMode==="file"
     ?<label className="form-label d-block">Choisir une image
      <input type="file" className="form-control" accept="image/png,image/jpeg,image/webp"
       onChange={e=>{const selected=e.target.files?.[0]??null;setLogoFile(selected);if(selected)setLogoRemoved(false);}}/>
     </label>
     :<label className="form-label d-block">URL HTTPS directe du logo
      <input type="url" className="form-control" value={remoteLogo} placeholder="https://…/logo.png"
       onChange={e=>{setRemoteLogo(e.target.value);if(e.target.value.trim())setLogoRemoved(false);}}/>
     </label>}
    <p className="form-text">PNG, JPEG ou WebP, maximum 1 Mo. Une seule URL suffit : LMN24 télécharge le logo et enregistre son adresse locale.</p>
    <div className="d-flex flex-wrap gap-2">
     <a target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary"
      href={"https://www.google.com/search?tbm=isch&q="+encodeURIComponent("logo "+name)}>
      Rechercher sur Google Images ↗</a>
     <a target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary"
      href={"https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent("logo "+name)+"&title=Special:MediaSearch&type=image"}>
      Rechercher sur Wikimedia Commons ↗</a>
    </div>
    <p className="form-text">Vérifiez les droits de réutilisation. La recherche n’importe aucune image automatiquement.</p>
   </fieldset>
   <ChannelUrlInputs values={urls} hideLogo onChange={setUrls}/>
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end mt-3">
    <button className="btn btn-outline-secondary" type="button" onClick={onClose}>Annuler</button>
    <button className="btn btn-primary" type="submit" disabled={busy}>Enregistrer</button>
   </div>
  </form>;
 return page?<main className="container-fluid px-2 px-md-4 py-3">
  <h1 className="h3 mb-3">Modifier la chaîne — {item.name}</h1>
  <div className="card p-3 p-md-4">{form}</div>
 </main>:<Modal title={"Modifier la chaîne — "+item.name} onClose={onClose}>{form}</Modal>;
}
/** Fast catalogue edits keep all remaining association fields unchanged.
 * Existing concurrency and national-number constraints are enforced by the API.
 */
function ChannelQuickControls({item,onSaved}:{item:Channel;onSaved:()=>void}){
 const [editing,setEditing]=useState(false);
 const [number,setNumber]=useState(item.effectiveNumber===null?"":String(item.effectiveNumber));
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [active,setActive]=useState(item.isActive);
 const [currentNumber,setCurrentNumber]=useState(item.effectiveNumber);
 useEffect(()=>{
  setActive(item.isActive);
  setCurrentNumber(item.effectiveNumber);
  if(!editing)setNumber(item.effectiveNumber===null?"":String(item.effectiveNumber));
 },[item.isActive,item.effectiveNumber,item.version,editing]);
 async function update(nextActive:boolean,nextManual:number|null){
  if(pending)return false;
  const effective=nextManual??item.officialNumber??item.assignedNumber;
  setPending(true);setError("");
  try{
   await request("catalog/associations/"+item.id,"PATCH",{
    isActive:nextActive,needsReview:item.needsReview,manualNumber:nextManual,
    officialNumber:item.officialNumber,assignedNumber:item.assignedNumber,
    defaultVariantId:item.defaultVariantId,expectedVersion:item.version,
   });
   setActive(nextActive);
   setCurrentNumber(effective);
   setEditing(false);
   onSaved();
   return true;
  }catch(e){
   setError((e as Error).message);
   return false;
  }finally{setPending(false);}
 }
 function saveNumber(){
  const raw=number.trim();
  const next=raw===""?null:Number(raw);
  if(next!==null&&(!Number.isInteger(next)||next<1||next>2147483647)){
   setError("Saisissez un numéro entier compris entre 1 et 2 147 483 647.");
   return;
  }
  void update(active,next);
 }
 return <>
  <td>
   {editing?<div className="d-flex align-items-center gap-1">
    <input autoFocus type="number" min={1} max={2147483647}
     className="form-control form-control-sm" style={{width:100}}
     aria-label={"Numéro de "+item.name} value={number} disabled={pending}
     onChange={e=>setNumber(e.target.value)}
     onKeyDown={e=>{
      if(e.key==="Enter"){e.preventDefault();saveNumber();}
      if(e.key==="Escape"){setEditing(false);setError("");}
     }}/>
    <button type="button" className="btn btn-sm btn-outline-primary" disabled={pending}
     title="Enregistrer le numéro" aria-label="Enregistrer le numéro"
     onClick={saveNumber}>✓</button>
    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pending}
     title="Annuler" aria-label="Annuler la saisie du numéro"
     onClick={()=>{setEditing(false);setError("");}}>×</button>
   </div>:<button type="button" className="btn btn-sm btn-link text-body text-decoration-none w-100 text-start"
     disabled={pending} title="Modifier le numéro"
     aria-label={"Modifier le numéro de "+item.name}
     onClick={()=>{setNumber(currentNumber===null?"":String(currentNumber));setError("");setEditing(true);}}>
     {currentNumber??"—"} <span className="small text-secondary" aria-hidden="true">✎</span>
    </button>}
   {error&&<div className="small text-danger mt-1" role="alert">{error}</div>}
  </td>
  <td>
   <div className="d-flex align-items-center gap-2">
    <label className={styles.channelSwitch}>
     <input type="checkbox" role="switch" checked={active} disabled={pending}
      aria-label={(active?"Désactiver ":"Activer ")+item.name}
      onChange={e=>void update(e.target.checked,item.manualNumber)}/>
     <span className={styles.channelSwitchTrack} aria-hidden="true"/>
    </label>
    <span>{active?"Active":"Inactive"}{item.needsReview?" · À vérifier":""}</span>
   </div>
  </td>
 </>;
}
const rights=["programme","synopsis","image","logo"] as const;
type RightsName=typeof rights[number];
function SourceEditor({countries,locale,countryNames,onClose,onSaved}:{
 countries:Country[];locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:()=>void;
}){
 const [name,setName]=useState("");const [url,setUrl]=useState("");
 const [format,setFormat]=useState("XMLTV");const [active,setActive]=useState(false);
 const [geographicScope,setGeographicScope]=useState<"GLOBAL"|"COUNTRY">("GLOBAL");
 const [scopeCountryId,setScopeCountryId]=useState("");
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
    await request("epg-sources","POST",{name,sourceUrl:url,format,isActive:active,
     geographicScope,scopeCountryId:geographicScope==="COUNTRY"?scopeCountryId:null,
     rights:rightsPayload});
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
   <label className="d-block mt-3">Périmètre de la source
    <select className="form-select" value={geographicScope}
     onChange={e=>setGeographicScope(e.target.value as "GLOBAL"|"COUNTRY")}>
     <option value="GLOBAL">Global — plusieurs pays</option>
     <option value="COUNTRY">Un seul pays</option>
    </select>
   </label>
   {geographicScope==="COUNTRY"&&<label className="d-block mt-3">Pays
    <select className="form-select" required value={scopeCountryId}
     onChange={e=>setScopeCountryId(e.target.value)}>
     <option value="">Sélectionner le pays du flux</option>
     {countries.map(c=><option key={c.countryId} value={c.countryId}>
      {c.isoCode2}</option>)}
    </select>
   </label>}
   <p className="small text-body-secondary">
    {geographicScope==="GLOBAL"
     ?"Le moteur utilise l’attribut country de chaque chaîne XMLTV ; sans country, la chaîne reste à classer."
     :"Toutes les chaînes de cette source sont rattachées à ce pays et restent inactives jusqu’à validation."}
   </p>
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
    <button className="btn btn-primary" disabled={busy||(geographicScope==="COUNTRY"&&!scopeCountryId)} type="submit">Créer</button>
   </div>
  </form>
 </Modal>;
}
type OrderedSource={sourceId:string;name:string;isActive:boolean;
 countrySourceActive:boolean;priority:number|null};
function SourcePrioritiesEditor({countries,locale,countryNames,onClose,onSaved}:{
 countries:Country[];locale:string;countryNames:TvCountryNames;
 onClose:()=>void;onSaved:()=>void;
}){
 const [countryId,setCountryId]=useState(countries[0]?.countryId??"");
 const [items,setItems]=useState<OrderedSource[]>([]);
 const [loading,setLoading]=useState(countries.length>0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!countryId)return;
  const controller=new AbortController();
  void fetch(api+"epg-sources/countries/"+countryId+"/priorities",{
   cache:"no-store",signal:controller.signal,
  }).then(async response=>{
   if(!response.ok)throw new Error(messageFor(response.status));
   return response.json() as Promise<{items:OrderedSource[]}>;
  }).then(payload=>{if(!controller.signal.aborted)setItems(payload.items);})
   .catch(err=>{if(!controller.signal.aborted)setError((err as Error).message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[countryId]);
 function move(index:number,delta:number){
  setItems(previous=>{
   const target=index+delta;
   if(target<0||target>=previous.length)return previous;
   const next=[...previous];
   [next[index],next[target]]=[next[target]!,next[index]!];
   return next;
  });
 }
 async function save(){
  if(busy||loading||!countryId)return;
  setBusy(true);setError("");
  try{
   await request("epg-sources/countries/"+countryId+"/priorities","PUT",{
    items:items.map((source,index)=>({
     sourceId:source.sourceId,countryId,priority:index+1,
     isActive:source.countrySourceActive,
    })),
   });
   onSaved();
  }catch(err){setError((err as Error).message);}
  finally{setBusy(false);}
 }
 return <Modal title="Ordre d’utilisation des sources EPG" onClose={onClose}>
  <p className="text-body-secondary">Définissez les priorités pour un pays.
   La priorité 1 est la plus élevée. Les autres sources actives peuvent compléter
   la couverture ; cet ordre ne remplace pas la vérification des correspondances ni des droits.</p>
  <label className="form-label" htmlFor="tv-epg-priority-country">Pays</label>
  <select id="tv-epg-priority-country" className="form-select mb-3"
   value={countryId} disabled={busy} onChange={e=>{
    setCountryId(e.target.value);setItems([]);setLoading(true);setError("");
   }}>
   {countries.map(c=><option key={c.countryId} value={c.countryId}>
    {region(c.isoCode2,locale,countryNames)}</option>)}
  </select>
  {loading&&<p role="status">Chargement des priorités…</p>}
  {error&&<p role="alert" className="alert alert-danger">{error}</p>}
  {!loading&&items.length>0&&<div className="table-responsive">
   <table className="table table-hover align-middle">
    <thead><tr><th>Priorité</th><th>Source EPG</th><th>Dans ce pays</th><th>Ordre</th></tr></thead>
    <tbody>{items.map((source,index)=><tr key={source.sourceId}>
     <td>{index+1}</td>
     <td>{source.name}
      {!source.isActive&&<span className="text-body-secondary small"> (inactive globalement)</span>}
     </td>
     <td><label className="d-flex gap-2 align-items-center">
      <input type="checkbox" className="form-check-input m-0"
       checked={source.countrySourceActive} disabled={busy||!source.isActive}
       onChange={e=>setItems(previous=>previous.map(v=>v.sourceId===source.sourceId
        ?{...v,countrySourceActive:e.target.checked}:v))}/>
      <span className="small">{source.countrySourceActive&&source.isActive?"Active":"Inactive"}</span>
     </label></td>
     <td><div className="d-flex gap-2">
      <button type="button" className="btn btn-sm btn-outline-secondary"
       aria-label={"Monter "+source.name} title="Monter"
       disabled={busy||index===0} onClick={()=>move(index,-1)}>↑</button>
      <button type="button" className="btn btn-sm btn-outline-secondary"
       aria-label={"Descendre "+source.name} title="Descendre"
       disabled={busy||index===items.length-1} onClick={()=>move(index,1)}>↓</button>
     </div></td>
    </tr>)}</tbody>
   </table>
  </div>}
  {!loading&&items.length===0&&!error&&<p>Aucune source EPG configurée.</p>}
  <p className="text-body-secondary small">Une source inactive globalement ne sera
   pas utilisée, même si son option par pays était activée. Les modifications
   prennent effet aux prochains imports.</p>
  <div className="d-flex justify-content-end gap-2 mt-3">
   <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
   <button type="button" className="btn btn-primary" onClick={()=>void save()}
    disabled={!countryId||loading||busy||!!error||items.length===0}>
    {busy?"Enregistrement…":"Enregistrer l’ordre"}
   </button>
  </div>
 </Modal>;
}
type PendingDiscovery={id:string;sourceId:string;sourceName:string;externalId:string;channelId:string|null;channelName:string|null};
function EpgDiscoveryInbox({countries,onImported}:{
 countries:{id:string;name:string}[];
 onImported:()=>void;
}){
 const [search,setSearch]=useState("");
 const [query,setQuery]=useState("");
 const [page,setPage]=useState(1);
 const [items,setItems]=useState<PendingDiscovery[]>([]);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [countryId,setCountryId]=useState("");
 const [saving,setSaving]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [sort,setSort]=useState<TvSortState>(null);

 const toggleSort=(key:string)=>{setSort(current=>nextTvSort(current,key));setPage(1);setSelected([]);};
 async function importSelected(){
  if(saving||!countryId||!selected.length)return;
  setSaving(true);setError("");setFeedback("");
  try{
   const result=await request<{created:number;existing:number}>(
    "epg-sources/discoveries/import","POST",{countryId,mappingIds:selected});
   setFeedback((result.created+result.existing)+" chaînes rattachées au pays, "+
    "inactives. Elles sont désormais visibles dans Chaînes avec le pays choisi.");
   setSelected([]);setRefresh(x=>x+1);onImported();
  }catch(err){setError((err as Error).message);}
  finally{setSaving(false);}
 }
 useEffect(()=>{
  const controller=new AbortController();
  void fetch(api+"epg-sources/discoveries?page="+page+"&search="+encodeURIComponent(query)+
   "&countryId=UNCLASSIFIED&sort="+encodeURIComponent(sort?.key??"source")+
   "&direction="+encodeURIComponent(sort?.direction??"asc"),{
   cache:"no-store",signal:controller.signal,
  }).then(async res=>{
   if(!res.ok)throw new Error(messageFor(res.status));
   return res.json() as Promise<{items:PendingDiscovery[];total:number}>;
  }).then(data=>{
   if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}
  }).catch(err=>{if(!controller.signal.aborted)setError((err as Error).message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[page,query,refresh,sort]);
 return <AdminDataPanel label="Chaînes EPG découvertes — à classer">
  <div className="p-3">
   <p className="text-body-secondary">
    Seules les chaînes dont le pays n’est pas identifié apparaissent ici.
    Pour une source nationale ou un flux global contenant l’attribut country,
    le pays est déjà associé automatiquement et la chaîne est visible dans « Chaînes ».
   </p>
   <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={e=>{
    e.preventDefault();setPage(1);setSelected([]);setQuery(search);
   }}>
    <input className="form-control" style={{maxWidth:380}} type="search"
     aria-label="Rechercher une chaîne EPG découverte"
     placeholder="Identifiant externe ou source" value={search}
     onChange={e=>setSearch(e.target.value)}/>
    <button className="btn btn-outline-primary" type="submit">Rechercher</button>
   </form>
   <p className="small text-body-secondary">{total.toLocaleString("fr-FR")} identifiants EPG à examiner</p>
   {feedback&&<p role="status" className="alert alert-success">{feedback}</p>}
   {loading&&<p role="status">Chargement des découvertes…</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   {!loading&&!error&&<div className="table-responsive">
    <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
     <label>Associer les chaînes sélectionnées au pays
      <select className="form-select" value={countryId}
       disabled={saving} onChange={e=>setCountryId(e.target.value)}>
       {countries.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
      </select>
     </label>
     <button className="btn btn-primary" type="button"
      disabled={saving||!selected.length||!countryId}
      onClick={()=>void importSelected()}>
      {saving?"Association…":"Associer "+selected.length+" chaînes au pays (inactives)"}
     </button>
    </div>
    <p className="small text-body-secondary">
     Sélectionne les chaînes sans pays, choisis le pays puis clique sur Associer.
     Elles resteront inactives ; aucune grille n’est publiée.
    </p>
    <table className="table table-hover align-middle">
     <thead><tr>
      <th><input type="checkbox" aria-label="Sélectionner toutes les chaînes visibles"
       checked={items.length>0&&items.every(x=>selected.includes(x.id))}
       onChange={e=>setSelected(e.target.checked
        ?[...new Set([...selected,...items.map(x=>x.id)])]
        :selected.filter(id=>!items.some(x=>x.id===id)))} /></th>
      <TvSortableHeader label="Chaîne et identifiant EPG" sortKey="channel" sort={sort} onSort={toggleSort}/>
      <TvSortableHeader label="Source" sortKey="source" sort={sort} onSort={toggleSort}/>
      <TvSortableHeader label="Pays" sortKey="country" sort={sort} onSort={toggleSort}/>
     </tr></thead>
     <tbody>{items.map(item=><tr key={item.id}>
      <td><input type="checkbox" aria-label={"Sélectionner "+item.externalId}
       checked={selected.includes(item.id)}
       onChange={e=>setSelected(previous=>e.target.checked
        ?[...previous,item.id]:previous.filter(id=>id!==item.id))}/></td>
      <td><strong>{item.channelName??item.externalId}</strong><div><code>{item.externalId}</code></div></td><td>{item.sourceName}</td>
      <td>Pays inconnu</td>
     </tr>)}</tbody>
    </table>
    {!items.length&&<p>Aucune chaîne EPG en attente dans cette sélection.</p>}
    <div className="d-flex justify-content-between align-items-center">
     <span className="small text-body-secondary">Page {page} / {Math.max(1,Math.ceil(total/50))}</span>
     <div className="d-flex gap-2">
      <button className="btn btn-sm btn-outline-secondary" type="button"
       disabled={page===1} onClick={()=>{setSelected([]);setPage(x=>x-1);}}>Précédent</button>
      <button className="btn btn-sm btn-outline-secondary" type="button"
       disabled={page*50>=total} onClick={()=>{setSelected([]);setPage(x=>x+1);}}>Suivant</button>
     </div>
    </div>
   </div>}
  </div>
 </AdminDataPanel>;
}
function ImportEditor({countries,sources,locale,countryNames,onClose,onSaved}:{countries:Country[];sources:Source[];locale:string;countryNames:TvCountryNames;onClose:()=>void;onSaved:(id:string)=>void}){
 const [country,setCountry]=useState("");const [days,setDays]=useState(7);
 const [mode,setMode]=useState<"DISCOVERY"|"STAGING">("DISCOVERY");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const eligible=country?countries.filter(c=>c.countryId===country):countries.filter(c=>c.isActive);
 const perCountry=eligible.map(c=>({country:c,sources:sources.filter(s=>s.isActive&&(s.geographicScope==="GLOBAL"||s.scopeCountryId===c.countryId))}));
 return <Modal title="Lancer un import EPG manuel" onClose={onClose}>
  <form onSubmit={async e=>{e.preventDefault();if(busy||eligible.length===0)return;
   setBusy(true);setError("");
   try{const created=await request<{id:string;status:string}>("import-runs","POST",{
    days,mode,...(country?{countryId:country}:{})});
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
   <label className="form-label" htmlFor="tv-import-mode">Type d’import</label>
   <select id="tv-import-mode" className="form-select mb-3" value={mode}
    onChange={e=>setMode(e.target.value as "DISCOVERY"|"STAGING")}>
    <option value="DISCOVERY">Découvrir les identifiants des chaînes</option>
    <option value="STAGING">Importer les programmes dans le catalogue privé</option>
   </select>
   <p className="text-body-secondary">{eligible.length} pays concernés, {new Set(perCountry.flatMap(x=>x.sources.map(s=>s.id))).size} sources distinctes potentiellement éligibles.
    {mode==="DISCOVERY"
     ?" Les identifiants des chaînes sont découverts et attendent une vérification ; aucun programme n’est enregistré."
     :" Seules les émissions de chaînes déjà associées et vérifiées, issues de sources autorisées avec une référence de droits, sont enregistrées dans le catalogue privé. Aucune grille n’est publiée."}
    {" "}Les sources actives sont prises en compte selon leur priorité par pays.</p>
   {eligible.length===0&&<p className="alert alert-warning">Aucun pays éligible : activez les pays souhaités dans Guide TV — Pays ou sélectionnez un pays précis.</p>}
   {eligible.length>0&&<details className="mb-3"><summary>Voir les sources prévues par pays ({perCountry.reduce((n,x)=>n+x.sources.length,0)} périmètres potentiels)</summary>
    <ul className="mt-2">{perCountry.map(x=><li key={x.country.countryId}>{region(x.country.isoCode2,locale,countryNames)} : {x.sources.length} source(s) — {x.sources.map(s=>s.name).join(", ")||"aucune"}</li>)}</ul>
    <small className="text-body-secondary">Prévision hors éventuelles désactivations spécifiques par pays ; le suivi après lancement fait foi.</small>
   </details>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   <div className="d-flex gap-2 justify-content-end">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Annuler</button>
    <button type="submit" disabled={busy||eligible.length===0} className="btn btn-primary">{busy?"Démarrage…":"Lancer l’import"}</button>
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
 const [dialog,setDialog]=useState<"source"|"import"|"channel"|"priorities"|null>(null);
 const [countryEditor,setCountryEditor]=useState<Country|null>(null);
 const [channelEditor,setChannelEditor]=useState<Channel|null>(null);
 const [sourceEditor,setSourceEditor]=useState<Source|null>(null);
 const [filter,setFilter]=useAdminSessionFilter("tv-"+view,"search","");
 const [serverChannelSearch,setServerChannelSearch]=useState("");
 useEffect(()=>{
  if(view!=="channels")return;
  const timeout=setTimeout(()=>setServerChannelSearch(filter.trim().slice(0,120)),250);
  return ()=>clearTimeout(timeout);
 },[filter,view]);
 const [country,setCountry]=useAdminSessionFilter("tv-"+view,"country","");
 const [status,setStatus]=useAdminSessionFilter("tv-"+view,"status","all");
 const [page,setPage]=useAdminSessionFilter("tv-"+view,"page",1);
 const [channelPageSize,setChannelPageSize]=useState<number>(DEFAULT_PAGE_SIZE);
 const [channelPageSizeRestored,setChannelPageSizeRestored]=useState(false);
 useEffect(()=>{
  try{
   const raw=window.localStorage.getItem(CHANNEL_PAGE_SIZE_STORAGE_KEY);
   const stored=raw===null?null:Number(raw);
   if(stored!==null&&CHANNEL_PAGE_SIZES.some(size=>size===stored))setChannelPageSize(stored);
  }catch{/* Private browsing or disabled storage: keep default. */}
  setChannelPageSizeRestored(true);
 },[]);
 useEffect(()=>{
  if(!channelPageSizeRestored)return;
  try{window.localStorage.setItem(CHANNEL_PAGE_SIZE_STORAGE_KEY,String(channelPageSize));}
  catch{/* Storage is optional. */}
 },[channelPageSize,channelPageSizeRestored]);
 const [sort,setSort]=useState<TvSortState>(null);
 const [expandedChannelGroups,setExpandedChannelGroups]=useState<string[]>([]);
 const toggleSort=(key:string)=>{setSort(current=>nextTvSort(current,key));setPage(1);};
 const [selectedRun,setSelectedRun]=useState("");
 const [deletingRun,setDeletingRun]=useState("");
 useEffect(()=>{
  const abort=new AbortController();const current=reload;
  async function load(){
   setLoading(true);setError("");
   try{
    const paths:{[key:string]:string}={
     countries:"catalog/countries",channels:"catalog/channels",sources:"epg-sources",
     imports:"import-runs?page=1&pageSize=100"};
    const channelRequest="catalog/channels"+(country||serverChannelSearch
     ?"?"+new URLSearchParams({
      ...(country?{countryId:country}:{}),
      ...(serverChannelSearch?{search:serverChannelSearch}:{})
     }).toString():"");
    const requested=view==="overview"||view==="statistics"?
     ["catalog/countries","catalog/channels","epg-sources","import-runs?page=1&pageSize=100"]:
     view==="translations"?["catalog/channels"]:
      (view==="sources"||view==="channels"||view==="associations")
       ?["epg-sources","catalog/countries",
         ...(view==="associations"?[]:[view==="channels"
           ?channelRequest:"catalog/channels"])] :
     view==="imports"?["import-runs?page=1&pageSize=100","catalog/countries","epg-sources"]:
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
     else if(name.startsWith("catalog/channels"))setChannels((payload as {items:Channel[]}).items);
     else if(name==="epg-sources")setSources((payload as {items:Source[]}).items);
     else if(name.startsWith("import-runs"))setRuns((payload as {items:ImportRun[]}).items);
    }
   }catch(e){if(!abort.signal.aborted)setError((e as Error).message);}
   finally{if(!abort.signal.aborted)setLoading(false);}
  }
  void load();return ()=>abort.abort();
 },[view,reload,router,country,serverChannelSearch]);
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
 // Refresh the run and event history while a dispatched worker is active.
 // Unlike the queue creation endpoint, this is read-only polling.
 useEffect(()=>{
  if(view!=="imports"||!selectedRun
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
 },[view,selectedRun,detail?.status]);
 async function deleteImport(id:string){
  if(deletingRun||!window.confirm("Supprimer cet import de l'historique ? Cette action ne modifie ni les chaînes ni les programmes TV."))return;
  setDeletingRun(id);setError("");setNotice("");
  try{
   await request<{deleted:boolean}>("import-runs/"+id,"DELETE");
   setRuns(previous=>previous.filter(run=>run.id!==id));
   if(selectedRun===id){setSelectedRun("");setDetail(null);setEvents([]);}
   setNotice("Import supprimé.");
   setReload(value=>value+1);
  }catch(err){setError((err as Error).message);}
  finally{setDeletingRun("");}
 }
 function saved(){setDialog(null);setCountryEditor(null);setChannelEditor(null);setSourceEditor(null);setReload(v=>v+1);}
 // All country selectors share the same locale-aware alphabetical order.
 const sortedCountries=useMemo(()=>{
  const collator=new Intl.Collator(locale,{sensitivity:"base",numeric:true});
  return [...countries].sort((a,b)=>collator.compare(
   region(a.isoCode2,locale,countryNames),
   region(b.isoCode2,locale,countryNames)
  )||a.isoCode2.localeCompare(b.isoCode2));
 },[countries,locale,countryNames]);
 const countryCodes=useMemo(()=>new Map(countries.map(c=>[c.countryId,c.isoCode2])),[countries]);
 const filtered=useMemo(()=>{
  const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const pool=view==="countries"?sortedCountries:view==="channels"?channels:view==="sources"?sources:runs;
  return pool.filter(item=>{
   const searchTerm=normal(filter.trim());
   if(searchTerm){
    const searchable=view==="channels"?(item as Channel).name
     :view==="countries"?region((item as Country).isoCode2,locale,countryNames)+" "+(item as Country).isoCode2
     :view==="sources"?(item as Source).name
     :String((item as ImportRun).createdAt)+" "+(item as ImportRun).status+" "+(item as ImportRun).trigger;
    if(!normal(searchable).includes(searchTerm))return false;
   }
   if(country&&("countryId" in item)&&item.countryId!==country)return false;
   if(status==="active"&&("isActive" in item)&&!item.isActive)return false;
   if(status==="inactive"&&("isActive" in item)&&item.isActive)return false;
   if(status==="review"&&("needsReview" in item)&&!item.needsReview)return false;
   return true;
  });
 },[view,sortedCountries,channels,sources,runs,filter,country,status,locale,countryNames]);
 const channelGroups=useMemo(()=>groupTvChannels(
  view==="channels"?(filtered as Channel[]):[]
 ),[filtered,view]);
 const rowsForSort=view==="channels"?channelGroups.representatives:filtered;
 const sortedRows=useMemo(()=>sortTvRows(rowsForSort,sort,(item,key)=>{
  if(view==="countries"){
   const v=item as Country;
   switch(key){
    case "name":return region(v.isoCode2,locale,countryNames);
    case "iso":return v.isoCode2;
    case "status":return v.isActive;
    case "timezone":return v.referenceTimezone;
    case "channels":return v.approvedChannelCount;
    case "coverage":return null;
   }
  }
  if(view==="channels"){
   const v=item as Channel;
   switch(key){
    case "name":return v.name;
    case "country":return region(countryCodes.get(v.countryId)??"",locale,countryNames);
    case "number":return v.effectiveNumber;
    case "status":return v.needsReview?"À vérifier":v.isActive?"Active":"Inactive";
   }
  }
  if(view==="sources"){
   const v=item as Source;
   switch(key){
    case "name":return v.name;
    case "format":return v.format;
    case "scope":return v.geographicScope==="COUNTRY"
     ?region(countryCodes.get(v.scopeCountryId??"")??"",locale,countryNames)
     :v.countryId?"Globale · "+region(countryCodes.get(v.countryId)??"",locale,countryNames):"Globale";
    case "rights":return v.programmeRightsStatus;
    case "status":return v.isActive;
   }
  }
  if(view==="imports"){
   const v=item as ImportRun;
   switch(key){
    case "date":return new Date(v.createdAt).getTime();
    case "trigger":return v.trigger;
    case "days":return v.requestedDays;
    case "status":return v.status;
    case "scope":return v.scopeCount;
   }
  }
  return null;
 },locale),[rowsForSort,sort,view,locale,countryNames,countryCodes]);
 const pageSize=view==="channels"?channelPageSize:DEFAULT_PAGE_SIZE;
 const pages=Math.max(1,Math.ceil(sortedRows.length/pageSize));
 const visible=sortedRows.slice((Math.min(page,pages)-1)*pageSize,Math.min(page,pages)*pageSize);
 const action=view==="channels"?<button className="btn btn-primary" type="button" onClick={()=>setDialog("channel")}>Ajouter une chaîne</button>
   :view==="sources"?<div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-primary" type="button" onClick={()=>setDialog("priorities")}>Ordre des sources</button><button className="btn btn-primary" type="button" onClick={()=>setDialog("source")}>Ajouter une source EPG</button></div>
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
     <label className={view==="channels"?"col-12 col-md-3":"col-12 col-md-4"}>Recherche
      <input className="form-control" type="search" value={filter}
       onChange={e=>{setFilter(e.target.value);setPage(1);}}/>
     </label>
     {view==="channels"&&<label className="col-12 col-md-3">Pays
      <select className="form-select" value={country} onChange={e=>{setCountry(e.target.value);setPage(1);}}>
       <option value="">Tous les pays</option>{sortedCountries.map(c=>
        <option key={c.countryId} value={c.countryId}>{region(c.isoCode2,locale,countryNames)}</option>)}
      </select></label>}
     {view!=="imports"&&<label className={view==="channels"?"col-12 col-md-3":"col-12 col-md-4"}>Statut
      <select className="form-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
       <option value="all">Tous</option><option value="active">Actifs</option>
       <option value="inactive">Inactifs</option>
       {view==="channels"&&<option value="review">À vérifier</option>}
      </select></label>}
     {view==="channels"&&<label className="col-12 col-md-3">Lignes par page
      <select className="form-select" value={channelPageSize}
       onChange={e=>{setChannelPageSize(Number(e.target.value));setPage(1);}}>
       {CHANNEL_PAGE_SIZES.map(size=><option key={size} value={size}>{size}</option>)}
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
  {view==="associations"&&!loading&&!error&&
   <EpgDiscoveryInbox countries={sortedCountries.map(c=>({
    id:c.countryId,name:region(c.isoCode2,locale,countryNames),
   }))} onImported={()=>setReload(x=>x+1)}/>}
  {view==="sources"&&<p className="text-body-secondary">Chaque source couvre soit un pays, soit plusieurs pays (Globale). Le pays configuré est affiché dans la colonne Périmètre. Utilisez « Ordre des sources » pour définir les priorités par pays. Les chaînes inconnues restent à vérifier avant publication.</p>}
   {(view==="countries"||view==="channels"||view==="sources"||view==="imports")&&!loading&&!error&&
   <AdminDataPanel label={"Liste "+LABELS[view]}>
    <div className="table-responsive"><table className="table table-hover align-middle mb-0">
     <thead><tr>
      {view==="countries"&&<><TvSortableHeader label="Pays" sortKey="name" sort={sort} onSort={toggleSort}/><TvSortableHeader label="ISO 2" sortKey="iso" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Statut" sortKey="status" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Fuseau IANA" sortKey="timezone" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Chaînes actives / total" sortKey="channels" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Couverture" sortKey="coverage" sort={sort} onSort={toggleSort}/><th>Actions</th></>}
      {view==="channels"&&<><TvSortableHeader label="Chaîne" sortKey="name" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Pays" sortKey="country" sort={sort} onSort={toggleSort}/><TvSortableHeader label="N°" sortKey="number" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Statut" sortKey="status" sort={sort} onSort={toggleSort}/><th>Actions</th></>}
      {view==="sources"&&<><TvSortableHeader label="Source" sortKey="name" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Format" sortKey="format" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Périmètre" sortKey="scope" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Droits programmes" sortKey="rights" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Statut" sortKey="status" sort={sort} onSort={toggleSort}/><th>Actions</th></>}
      {view==="imports"&&<><TvSortableHeader label="Date" sortKey="date" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Déclencheur" sortKey="trigger" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Jours" sortKey="days" sort={sort} onSort={toggleSort}/><TvSortableHeader label="État" sortKey="status" sort={sort} onSort={toggleSort}/><TvSortableHeader label="Périmètres" sortKey="scope" sort={sort} onSort={toggleSort}/><th>Actions</th></>}
     </tr></thead><tbody>
      {view==="countries"&&(visible as Country[]).map(v=><tr key={v.countryId}>
       <td>{region(v.isoCode2,locale,countryNames)}</td><td>{v.isoCode2}</td>
       <td>{v.isActive?"Actif":"Inactif"}</td><td>{v.referenceTimezone}</td>
       <td>{v.approvedChannelCount} / {v.channelCount}</td><td>Inconnue</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+region(v.isoCode2,locale,countryNames)} onClick={()=>setCountryEditor(v)}/></td>
      </tr>)}
      {view==="channels"&&(visible as Channel[]).map(v=>{
       const key=tvChannelDisplayKey(v);
       const members=channelGroups.members.get(key)??[v];
       const expanded=expandedChannelGroups.includes(key);
       const groupRows=expanded?members:[v];
       return <Fragment key={key}>{groupRows.map((entry,index)=>{
        const isoCode=countryCodes.get(entry.countryId)?.toLowerCase()??"";
        return <tr key={entry.id}>
         <td><div className="d-flex align-items-center gap-3">
          <span className={styles.channelLogoSlot} aria-hidden="true">
           {entry.logoUrl&&<img src={entry.logoUrl} alt="" loading="lazy"
            className={styles.channelLogoImage}
            onError={e=>{e.currentTarget.style.visibility="hidden";}}/>}
          </span>
          <div>
           <span>{entry.name}</span>
           {members.length>1&&index===0&&<button type="button"
            className="btn btn-sm btn-outline-secondary ms-2"
            aria-expanded={expanded}
            onClick={()=>setExpandedChannelGroups(old=>old.includes(key)
             ?old.filter(item=>item!==key):[...old,key])}>
            {expanded?"Masquer les fiches":"Voir les "+members.length+" fiches"}
           </button>}
           {expanded&&index>0&&<div className="small text-body-secondary">
            Autre fiche · identifiant {entry.channelId.slice(0,8)}
           </div>}
          </div>
         </div></td>
         <td><div className="d-flex align-items-center gap-2">
          {isoCode&&<img src={`/country-flags/w160/${isoCode}.png`} alt="" loading="lazy"
           style={{width:32,height:22,objectFit:"contain",flexShrink:0}}/>}
          <span>{region(countryCodes.get(entry.countryId)??"",locale,countryNames)}</span>
         </div></td>
         <ChannelQuickControls key={entry.id} item={entry} onSaved={()=>setReload(v=>v+1)}/>
         <td><AdminIconButton name="pencil-square" label={"Modifier "+entry.name}
          onClick={()=>router.push("/admin/tv/channels/"+encodeURIComponent(entry.id)+"/edit")}/></td>
        </tr>;
       })}</Fragment>;
      })}
      {view==="sources"&&(visible as Source[]).map((v,i)=><tr key={v.id+":"+(v.countryId??i)}>
       <td>{v.name}</td><td>{v.format}</td>
       <td>{v.geographicScope==="COUNTRY"
         ?region(countryCodes.get(v.scopeCountryId??"")??"",locale,countryNames)
         :v.countryId?("Globale · exception : "+region(countryCodes.get(v.countryId)??"",locale,countryNames)+(v.priority?" · priorité "+v.priority:""))
         :"Globale"}</td>
       <td>{v.programmeRightsStatus}</td><td>{v.isActive?"Active":"Inactive"}</td>
       <td><AdminIconButton name="pencil-square" label={"Modifier "+v.name} onClick={()=>setSourceEditor(v)}/></td>
      </tr>)}
      {view==="imports"&&(visible as ImportRun[]).map(v=><tr key={v.id}>
       <td>{new Date(v.createdAt).toLocaleString("fr-FR")}</td>
       <td>{v.trigger}</td><td>{v.requestedDays}</td><td>{v.status}</td>
       <td>{v.succeeded} réussis / {v.failed} échoués / {v.scopeCount} au total</td>
       <td><div className="d-flex gap-2 align-items-center">
        <AdminIconButton name="eye" label="Voir le détail" onClick={()=>void openRun(v.id)}/>
        {v.status!=="RUNNING"&&
         <AdminIconButton name="trash" label="Supprimer cet import" variant="outline-danger"
          disabled={!!deletingRun} onClick={()=>void deleteImport(v.id)}/>} 
       </div></td>
      </tr>)}
     </tbody></table></div>
    {rowsForSort.length===0&&<p className="p-3 text-body-secondary">Aucune donnée correspondant aux filtres.</p>}
    <div className="p-3"><AdminPagination page={Math.min(page,pages)} totalPages={pages} onPageChange={setPage}
      label={LABELS[view]}/></div>
   </AdminDataPanel>}
  {view==="imports"&&selectedRun&&<AdminDataPanel label="Suivi de l'import">
   <div className="p-3">
    <h2 className="h5">Import {selectedRun}</h2>
    {detail?<><p>Statut : {detail.status}</p>
     {detail.privateDrafts&&detail.privateDrafts.draftDays>0&&
      <p className="alert alert-info">
       Catalogue privé : {detail.privateDrafts.draftProgrammes.toLocaleString("fr-FR")} programmes,
       {" "}{detail.privateDrafts.draftAirings.toLocaleString("fr-FR")} diffusions,
       {" "}{detail.privateDrafts.draftDays.toLocaleString("fr-FR")} révisions de grille en préparation.
       Aucune de ces révisions n’est publiée.
      </p>}
     <ul>
     {detail.scopes.map(s=><li key={s.id}>{region(countryCodes.get(s.countryId)??"",locale,countryNames)} · {s.sourceName??sources.find(source=>source.id===s.sourceId)?.name??("Source "+(s.sourceId??"inconnue"))} · {s.status}
       {s.errorMessage?" — "+importDiagnostic(s.errorMessage):""}</li>)}</ul>
     {["PARTIAL","ERROR","INTERRUPTED"].includes(detail.status)&&detail.scopes.some(s=>["ERROR","INTERRUPTED"].includes(s.status))&&
      <button type="button" className="btn btn-outline-primary" onClick={async()=>{
       try{const r=await request<{id:string}>("import-runs/"+detail.id+"/retry","POST",{});await openRun(r.id);
        setReload(v=>v+1);}catch(e){setError((e as Error).message);}
      }}>Relancer uniquement les échecs</button>}
     <h3 className="h6 mt-3">Journal d’événements</h3>
     <ul>{events.map(e=>{const scope=detail.scopes.find(s=>s.id===e.scopeId);return <li key={e.id}>{new Date(e.occurredAt).toLocaleString("fr-FR")} · {e.level} · {e.eventType}{scope?" · "+region(countryCodes.get(scope.countryId)??"",locale,countryNames)+" / "+(scope.sourceName??sources.find(s=>s.id===scope.sourceId)?.name??"Source inconnue"):""} : {importDiagnostic(e.message)}</li>;})}</ul>
    </>:<p>Chargement…</p>}
   </div>
  </AdminDataPanel>}
  {view==="translations"&&!loading&&!error&&<TvTranslationPanel channels={channels}/>}
  {countryEditor&&<CountryEditor item={countryEditor} locale={locale} countryNames={countryNames} onClose={()=>setCountryEditor(null)} onSaved={saved}/>}
  
  {sourceEditor&&<TvEpgSourceEditor item={sourceEditor}
    channels={channels.map(ch=>({id:ch.channelId,name:ch.name,countryId:ch.countryId,
     countryLabel:region(countryCodes.get(ch.countryId)??"",locale,countryNames),
     defaultVariantId:ch.defaultVariantId}))}
    countries={sortedCountries.map(c=>({id:c.countryId,
     name:region(c.isoCode2,locale,countryNames),timezone:c.referenceTimezone,code:c.isoCode2}))}
    onClose={()=>setSourceEditor(null)} onSaved={saved}/>}
  {dialog==="priorities"&&<SourcePrioritiesEditor countries={sortedCountries} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)} onSaved={saved}/>}
  {dialog==="channel"&&<ChannelCreateEditor countries={sortedCountries} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)} onSaved={saved}/>}
   {dialog==="source"&&<SourceEditor countries={sortedCountries} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)} onSaved={saved}/>}
  {dialog==="import"&&<ImportEditor countries={sortedCountries} sources={sources} locale={locale} countryNames={countryNames} onClose={()=>setDialog(null)}
   onSaved={id=>{saved();void openRun(id);setNotice("Import lancé. Le suivi affiche les sources effectivement traitées et s’actualise automatiquement.");}}/>}
 </main>;
}

/** Full-page edition, preserving the same associations contract and save logic. */
export function TvChannelEditPage({associationId}:{associationId:string}){
 const router=useRouter();
 const [channel,setChannel]=useState<Channel|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  const ctrl=new AbortController();
  void fetch(api+"catalog/channels/associations/"+encodeURIComponent(associationId),
   {cache:"no-store",signal:ctrl.signal})
   .then(async response=>{
    if(!response.ok)throw new Error(response.status===404
     ?"Chaîne introuvable.":messageFor(response.status));
    return response.json() as Promise<Channel>;
   }).then(selected=>{
    if(!ctrl.signal.aborted)setChannel(selected);
   }).catch(e=>{if(!ctrl.signal.aborted)setError((e as Error).message);})
   .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
  return ()=>ctrl.abort();
 },[associationId]);
 if(loading)return <main className="container-fluid px-2 px-md-4 py-3"><p>Chargement de la chaîne…</p></main>;
 if(error||!channel)return <main className="container-fluid px-2 px-md-4 py-3">
  <p role="alert" className="alert alert-danger">{error||"Chaîne introuvable."}</p>
  <button type="button" className="btn btn-outline-secondary"
   onClick={()=>router.push("/admin/tv/channels")}>Retour aux chaînes</button>
 </main>;
 return <ChannelEditor item={channel} page
  onClose={()=>router.push("/admin/tv/channels")}
  onSaved={()=>router.push("/admin/tv/channels")}/>;
}
