"use client";
import {useEffect,useMemo,useState} from "react";
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
type MappingRow={id:string;sourceId:string;externalId:string;status:string;
 channelId:string|null;variantId:string|null;channelName:string|null};
type MappingChannel={id:string;name:string;countryId:string;countryLabel:string;
 defaultVariantId:string|null};
export function TvEpgSourceEditor({item,channels,onClose,onSaved}:{
 item:TvEpgSource;channels:MappingChannel[];onClose:()=>void;onSaved:()=>void;
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
 const [mappings,setMappings]=useState<MappingRow[]>([]);
 const [mappingLoading,setMappingLoading]=useState(true);
 const [mappingError,setMappingError]=useState("");
 const [mappingSearch,setMappingSearch]=useState("");
 const [mappingStatus,setMappingStatus]=useState("PENDING_REVIEW");
 const [mappingPage,setMappingPage]=useState(1);
 const [mappingBusy,setMappingBusy]=useState("");
 const [selection,setSelection]=useState<Record<string,string>>({});
 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/admin/tv/epg-sources/"+item.id+"/mappings",{
   cache:"no-store",signal:controller.signal,
  }).then(async res=>{
   if(!res.ok)throw new Error(await describeSaveError(res));
   return res.json() as Promise<{items:MappingRow[]}>;
  }).then(data=>{if(!controller.signal.aborted)setMappings(data.items);})
   .catch(err=>{if(!controller.signal.aborted)setMappingError((err as Error).message);})
   .finally(()=>{if(!controller.signal.aborted)setMappingLoading(false);});
  return ()=>controller.abort();
 },[item.id]);
 const filteredMappings=useMemo(()=>mappings.filter(m=>
  (mappingStatus==="ALL"||m.status===mappingStatus)
  &&(!mappingSearch||[m.externalId,m.channelName??""].join(" ")
   .toLocaleLowerCase().includes(mappingSearch.toLocaleLowerCase()))),
  [mappings,mappingStatus,mappingSearch]);
 const mappingPages=Math.max(1,Math.ceil(filteredMappings.length/15));
 async function reviewMapping(mapping:MappingRow,status:"VERIFIED"|"REJECTED"){
  const channelId=selection[mapping.id]??mapping.channelId??"";
  if(status==="VERIFIED"&&!channelId){
   setMappingError("Sélectionne une chaîne avant de valider sa correspondance.");
   return;
  }
  setMappingBusy(mapping.id);setMappingError("");
  try{
   const response=await fetch("/api/admin/tv/epg-sources/mappings/"+mapping.id,{
    method:"PATCH",headers:{"content-type":"application/json"},
    body:JSON.stringify({
     sourceId:item.id,externalId:mapping.externalId,
     channelId:status==="VERIFIED"?channelId:null,
     variantId:null,status,
    }),
   });
   if(!response.ok)throw new Error(await describeSaveError(response));
   const channel=channels.find(x=>x.id===channelId);
   setMappings(previous=>previous.map(x=>x.id===mapping.id
    ?{...x,status,channelId:status==="VERIFIED"?channelId:null,
       channelName:status==="VERIFIED"?channel?.name??null:null}:x));
  }catch(err){setMappingError((err as Error).message);}
  finally{setMappingBusy("");}
 }
 const [diagnosing,setDiagnosing]=useState(false);
 const [diagnostic,setDiagnostic]=useState<{
  ok:boolean;stage:string;code:string|null;bytes:number|null;
  programmes:number|null;channels:number|null;elapsedMs:number;
  skippedInvalidDuration?:number;
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
      {diagnostic.ok&&Boolean(diagnostic.skippedInvalidDuration)&&<div>Émissions à durée nulle ignorées : {diagnostic.skippedInvalidDuration?.toLocaleString("fr-FR")}</div>}
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
   <fieldset className="mt-4">
    <legend className="h5">Correspondances des chaînes EPG</legend>
    <p className="small text-body-secondary">Les identifiants découverts ne sont jamais associés automatiquement.
     Sélectionne une chaîne LMN24, puis valide explicitement la correspondance.
     Les programmes ne sont importés que pour les correspondances vérifiées.
     {mappings.length===1000?" Affichage limité aux 1 000 premières correspondances.":""}
    </p>
    {mappingLoading&&<p role="status">Chargement des identifiants EPG…</p>}
    {mappingError&&<p role="alert" className="alert alert-danger">{mappingError}</p>}
    {!mappingLoading&&<>
     <div className="d-flex flex-wrap gap-2 mb-2">
      <label className="flex-grow-1">Rechercher
       <input className="form-control" value={mappingSearch}
        onChange={e=>{setMappingSearch(e.target.value);setMappingPage(1);}}
        placeholder="Identifiant EPG ou chaîne"/>
      </label>
      <label>État
       <select className="form-select" value={mappingStatus}
        onChange={e=>{setMappingStatus(e.target.value);setMappingPage(1);}}>
        <option value="PENDING_REVIEW">À vérifier</option>
        <option value="VERIFIED">Vérifiées</option>
        <option value="REJECTED">Rejetées</option>
        <option value="ALL">Toutes</option>
       </select>
      </label>
     </div>
     <div className="table-responsive">
      <table className="table align-middle">
       <thead><tr><th>ID externe</th><th>Chaîne LMN24</th><th>Action</th></tr></thead>
       <tbody>{filteredMappings.slice((mappingPage-1)*15,mappingPage*15)
        .map(m=><tr key={m.id}>
         <td><code>{m.externalId}</code><div className="small text-body-secondary">{m.status}</div></td>
         <td><select className="form-select form-select-sm"
          aria-label={"Chaîne LMN24 pour "+m.externalId}
          disabled={!!mappingBusy}
          value={selection[m.id]??m.channelId??""}
          onChange={e=>setSelection(prev=>({...prev,[m.id]:e.target.value}))}>
          <option value="">Sélectionner une chaîne</option>
          {channels.map(ch=><option key={ch.id} value={ch.id}>
           {ch.countryLabel} · {ch.name}</option>)}
         </select></td>
         <td><div className="d-flex gap-1">
          <button className="btn btn-sm btn-outline-primary" type="button"
           disabled={!!mappingBusy||!(selection[m.id]??m.channelId)}
           onClick={()=>void reviewMapping(m,"VERIFIED")}>Valider</button>
          <button className="btn btn-sm btn-outline-secondary" type="button"
           disabled={!!mappingBusy} onClick={()=>void reviewMapping(m,"REJECTED")}>Rejeter</button>
         </div></td>
        </tr>)}</tbody>
      </table>
     </div>
     {!filteredMappings.length&&<p className="text-body-secondary">Aucune correspondance dans cette sélection.</p>}
     <div className="d-flex align-items-center justify-content-between gap-2">
      <span className="small text-body-secondary">{filteredMappings.length} correspondances · page {mappingPage}/{mappingPages}</span>
      <div className="d-flex gap-1">
       <button className="btn btn-sm btn-outline-secondary" type="button"
        disabled={mappingPage<=1} onClick={()=>setMappingPage(p=>p-1)}>Précédent</button>
       <button className="btn btn-sm btn-outline-secondary" type="button"
        disabled={mappingPage>=mappingPages} onClick={()=>setMappingPage(p=>p+1)}>Suivant</button>
      </div>
     </div>
    </>}
   </fieldset>
   <div className="d-flex justify-content-end mt-3">
    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Fermer</button>
   </div>
  </div>
 </div>;
}
