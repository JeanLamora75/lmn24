"use client";
import {useState} from "react";
import styles from "@/app/admin/(protected)/tv/tv-admin.module.css";
export type TvEpgSource={
 id:string;name:string;sourceUrl:string;format:string;isActive:boolean;version:string;
 programmeRightsStatus:string;programmeRightsReference:string|null;
 synopsisRightsStatus:string;synopsisRightsReference:string|null;
 imageRightsStatus:string;imageRightsReference:string|null;
 logoRightsStatus:string;logoRightsReference:string|null;
};
type ApiErrorPayload={message?:string|string[];error?:string};
async function describeSaveError(response:Response):Promise<string>{
 const labels:Record<number,string>={
  400:"Données invalides",
  401:"Session expirée : reconnectez-vous",
  403:"Accès réservé aux administrateurs",
  404:"Route API introuvable : vérifiez les versions frontend/backend",
  409:"Conflit de modification : actualisez la page",
  503:"Administration EPG indisponible : vérifiez les fonctionnalités activées",
 };
 const fallback=labels[response.status]??"Erreur du serveur";
 let details="";
 try{
  const result=await response.json() as ApiErrorPayload;
  const raw=Array.isArray(result.message)?result.message.join("; "):result.message;
  if(response.status<500&&typeof raw==="string"&&raw.length<=300)details=raw;
 }catch{/* Some proxies return HTML or no error payload. */}
 return `${fallback} (HTTP ${response.status})${details?": "+details:""}`;
}
const rightKeys=["programme","synopsis","image","logo"] as const;
type Key=typeof rightKeys[number];
const readable:Record<Key,string>={programme:"Programmes",synopsis:"Synopsis",image:"Images",logo:"Logos"};
const rightOptions=[{value:"UNREVIEWED",label:"À vérifier"},{value:"APPROVED",label:"Autorisé"},{value:"REJECTED",label:"Non autorisé"},{value:"EXPIRED",label:"Expiré"}] as const;
export function TvEpgSourceEditor({item,onClose,onSaved}:{
 item:TvEpgSource;onClose:()=>void;onSaved:()=>void;
}){
 const [name,setName]=useState(item.name);
 const [url,setUrl]=useState(item.sourceUrl);
 const [format,setFormat]=useState(item.format);
 const [active,setActive]=useState(item.isActive);
 const initial=Object.fromEntries(rightKeys.map(k=>[k,{
  status:item[(k+"RightsStatus") as keyof TvEpgSource]??"UNREVIEWED",
  reference:item[(k+"RightsReference") as keyof TvEpgSource]??"",
 }])) as Record<Key,{status:string;reference:string}>;
 const [rights,setRights]=useState(initial);
 const [diagnosing,setDiagnosing]=useState(false);
 const [diagnostic,setDiagnostic]=useState<{
  ok:boolean;stage:string;code:string|null;bytes:number|null;
  programmes:number|null;channels:number|null;elapsedMs:number;
 }|null>(null);
 async function testConnection(){
  if(busy||diagnosing)return;
  setError("");setDiagnostic(null);setDiagnosing(true);
  try{
   const response=await fetch("/api/admin/tv/epg-sources/"+item.id+"/test-connection",{
    method:"POST",cache:"no-store",
   });
   if(!response.ok)throw new Error(await describeSaveError(response));
   const result=await response.json() as NonNullable<typeof diagnostic>;
   setDiagnostic(result);
  }catch(e){setError((e as Error).message);}
  finally{setDiagnosing(false);}
 }
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 async function save(path:string,payload:unknown,message:string){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/admin/tv/epg-sources/"+item.id+"/"+path,{
    method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store",
   });
   if(!response.ok)throw new Error(await describeSaveError(response));
   setNotice(message);onSaved();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const saveRights=()=>save("rights",{...Object.fromEntries(rightKeys.map(k=>[k,{
  status:rights[k].status,reference:rights[k].reference.trim()||null,
 }])),expectedVersion:item.version},"Droits enregistrés.");
 return <div className={styles.dialogBackdrop}>
  <div role="dialog" aria-modal="true" aria-labelledby="tv-epg-edit-title"
   className={styles.dialog} onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
   <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
    <h2 id="tv-epg-edit-title">Source EPG — {item.name}</h2>
    <button type="button" className="btn btn-outline-secondary" onClick={onClose} aria-label="Fermer">×</button>
   </div>
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   {notice&&<p role="status" className="alert alert-info">{notice}</p>}
   <fieldset className="mb-4">
    <legend className="h5">Configuration</legend>
    <div className={styles.formGrid}>
     <label>Nom<input type="text" className="form-control" value={name} onChange={e=>setName(e.target.value)}/></label>
     <label>Format<select className="form-select" value={format} onChange={e=>setFormat(e.target.value)}>
      {["XMLTV","XMLTV_GZIP","JSON"].map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <label className="d-block mt-2">Adresse du flux<input className="form-control" type="url"
     value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <label className="form-check mt-2"><input className="form-check-input" type="checkbox"
     checked={active} onChange={e=>setActive(e.target.checked)}/>
     <span className="form-check-label">Source active</span></label>
    <div className="mt-3">
     <button type="button" className="btn btn-outline-primary"
      disabled={busy||diagnosing} onClick={()=>void testConnection()}>
      {diagnosing?"Test de connexion en cours…":"Tester la connexion"}
     </button>
     <p className="small text-body-secondary mt-2 mb-0">
      Teste l’URL et le format enregistrés dans la base, sans lancer d’import ni modifier les chaînes.
      {url!==item.sourceUrl||format!==item.format?" Enregistre d'abord les modifications pour tester les nouvelles valeurs.":""}
     </p>
     {diagnostic&&<div role="status" className={diagnostic.ok?"alert alert-success mt-2":"alert alert-warning mt-2"}>
      <strong>{diagnostic.ok?"Connexion et analyse réussies":"Échec du test de connexion"}</strong>
      <div>Étape : {diagnostic.stage} · Code : {diagnostic.code??"OK"} · Durée : {diagnostic.elapsedMs} ms</div>
      {diagnostic.code==="EPG_XML_SECURITY_REJECTED"&&<div>Le fichier contient une déclaration DOCTYPE ou ENTITY interdite. La connexion peut avoir réussi ; c’est le contrôle du XML qui bloque.</div>}
      {diagnostic.code==="EPG_TLS_HOSTNAME_MISMATCH"&&<div>Le certificat TLS reçu ne correspond pas au nom de domaine du fournisseur.</div>}
      {diagnostic.code==="EPG_NODE_ARGUMENT_INVALID"&&<div>Le moteur HTTP Node.js a rejeté un paramètre de la requête.</div>}
      {diagnostic.code==="EPG_JSON_INVALID"&&<div>Le contenu obtenu n’est pas un document JSON valide pour le format configuré.</div>}
      {diagnostic.bytes!==null&&<div>Fichier décompressé : {diagnostic.bytes.toLocaleString("fr-FR")} octets</div>}
      {diagnostic.ok&&<div>{diagnostic.channels?.toLocaleString("fr-FR")} chaînes · {diagnostic.programmes?.toLocaleString("fr-FR")} émissions</div>}
     </div>}
    </div>
    <button type="button" className="btn btn-primary mt-3" disabled={busy||!name.trim()||!url.trim()}
     onClick={()=>void save("configuration",{name,sourceUrl:url,format,isActive:active,expectedVersion:item.version},
      "Configuration enregistrée.")}>Enregistrer la configuration</button>
   </fieldset>
   <fieldset>
    <legend className="h5">Droits de republication</legend>
    <p className="small text-body-secondary">Indiquez votre décision pour chaque type de contenu. Aucune pièce justificative n’est demandée ici. La publication publique reste soumise aux contrôles de droits de LMN24.</p>
    {rightKeys.map(k=><div className="mb-3" key={k}>
     <label className="form-label" htmlFor={"right-"+k}>{readable[k]}</label>
     <select className="form-select" id={"right-"+k} value={rights[k].status}
      onChange={e=>setRights(old=>({...old,[k]:{...old[k],status:e.target.value}}))}>
      {rightOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
     </select>
    </div>)}
    <button type="button" className="btn btn-outline-primary" disabled={busy}
     onClick={()=>void saveRights()}>Enregistrer les droits</button>
   </fieldset>
   <div className="d-flex justify-content-end mt-3">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Fermer</button>
   </div>
  </div>
 </div>;
}
