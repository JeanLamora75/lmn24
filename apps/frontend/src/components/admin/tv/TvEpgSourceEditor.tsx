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
  if(typeof raw==="string"&&raw.length<=300)details=raw;
 }catch{/* Some proxies return HTML or no error payload. */}
 return `${fallback} (HTTP ${response.status})${details?": "+details:""}`;
}
const rightKeys=["programme","synopsis","image","logo"] as const;
type Key=typeof rightKeys[number];
const readable:Record<Key,string>={programme:"Programmes",synopsis:"Synopsis",image:"Images",logo:"Logos"};
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
 const missingEvidence=rightKeys.filter(k=>rights[k].status==="APPROVED"&&!rights[k].reference.trim());
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
    <button type="button" className="btn btn-primary mt-3" disabled={busy||!name.trim()||!url.trim()}
     onClick={()=>void save("configuration",{name,sourceUrl:url,format,isActive:active,expectedVersion:item.version},
      "Configuration enregistrée.")}>Enregistrer la configuration</button>
   </fieldset>
   <fieldset>
    <legend className="h5">Droits de republication</legend>
    <p className="small text-body-secondary">Chaque famille de contenu exige sa propre preuve avant approbation.
     L&apos;enregistrement des droits est indépendant de celui de la configuration.</p>
    {rightKeys.map(k=><div className="mb-3" key={k}>
     <label className="form-label" htmlFor={"right-"+k}>{readable[k]}</label>
     <div className={styles.formGrid}>
      <select className="form-select" id={"right-"+k} value={rights[k].status}
       onChange={e=>setRights(old=>({...old,[k]:{...old[k],status:e.target.value}}))}>
       {["UNREVIEWED","APPROVED","REJECTED","EXPIRED"].map(x=><option key={x} value={x}>{x}</option>)}</select>
      <input className="form-control" type="text" value={rights[k].reference} maxLength={2048}
       aria-label={"Justificatif "+readable[k]} placeholder="Référence de preuve (obligatoire si APPROVED)" required={rights[k].status==="APPROVED"}
       onChange={e=>setRights(old=>({...old,[k]:{...old[k],reference:e.target.value}}))}/>
     </div>
    </div>)}
    {missingEvidence.length>0&&<p role="status" className="small text-warning-emphasis">
      Pour enregistrer les droits, fournissez un justificatif pour {missingEvidence.map(k=>readable[k]).join(", ")},
      ou sélectionnez UNREVIEWED si les droits ne sont pas encore vérifiés.
     </p>}
    <button type="button" className="btn btn-outline-primary" disabled={busy||missingEvidence.length>0}
     onClick={()=>void saveRights()}>Enregistrer les droits</button>
   </fieldset>
   <div className="d-flex justify-content-end mt-3">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Fermer</button>
   </div>
  </div>
 </div>;
}
