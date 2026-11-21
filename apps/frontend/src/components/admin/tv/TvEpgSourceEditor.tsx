"use client";
import {useEffect,useMemo,useState} from "react";
import styles from "@/app/admin/(protected)/tv/tv-admin.module.css";
import {TvSortableHeader,sortTvRows,nextTvSort,type TvSortState} from "./TvSortableHeader";
export type TvEpgSource={
 id:string;name:string;sourceUrl:string;format:string;isActive:boolean;version:string;
 geographicScope:"GLOBAL"|"COUNTRY";scopeCountryId:string|null;
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
type MappingCountry={id:string;name:string;timezone:string;code:string};
export function TvEpgSourceEditor({item,channels,countries,initialMappingSearch="",onClose,onSaved}:{
 item:TvEpgSource;channels:MappingChannel[];countries:MappingCountry[];
 initialMappingSearch?:string;
 onClose:()=>void;onSaved:()=>void;
}){
 const [name,setName]=useState(item.name);
 const [url,setUrl]=useState(item.sourceUrl);
 const [format,setFormat]=useState(item.format);
 const [active,setActive]=useState(item.isActive);
 const [geographicScope,setGeographicScope]=useState(item.geographicScope??"GLOBAL");
 const [scopeCountryId,setScopeCountryId]=useState(item.scopeCountryId??"");
 const initial=Object.fromEntries(rightKeys.map(k=>[k,{
  status:item[(k+"RightsStatus") as keyof TvEpgSource]??"UNREVIEWED",
  reference:item[(k+"RightsReference") as keyof TvEpgSource]??"",
 }])) as Record<Key,{status:string;reference:string}>;
 const [rights,setRights]=useState(initial);
 const [mappings,setMappings]=useState<MappingRow[]>([]);
 const [mappingLoading,setMappingLoading]=useState(true);
 const [mappingError,setMappingError]=useState("");
 const [mappingSearch,setMappingSearch]=useState(initialMappingSearch);
 const [mappingStatus,setMappingStatus]=useState("PENDING_REVIEW");
 const [mappingPage,setMappingPage]=useState(1);
 const [mappingSort,setMappingSort]=useState<TvSortState>(null);
 const toggleMappingSort=(key:string)=>{setMappingSort(s=>nextTvSort(s,key));setMappingPage(1);};
 const [mappingBusy,setMappingBusy]=useState("");
 const [selection,setSelection]=useState<Record<string,string>>({});
 const [availableChannels,setAvailableChannels]=useState<MappingChannel[]>(channels);
 const [creatingFor,setCreatingFor]=useState<MappingRow|null>(null);
 const [newChannelCountry,setNewChannelCountry]=useState(countries[0]?.id??"");
 const [newChannelName,setNewChannelName]=useState("");

 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/admin/tv/epg-sources/"+item.id+"/mappings"+
   (initialMappingSearch?"?search="+encodeURIComponent(initialMappingSearch):""),{
   cache:"no-store",signal:controller.signal,
  }).then(async res=>{
   if(!res.ok)throw new Error(await describeSaveError(res));
   return res.json() as Promise<{items:MappingRow[]}>;
  }).then(data=>{if(!controller.signal.aborted)setMappings(data.items);})
   .catch(err=>{if(!controller.signal.aborted)setMappingError((err as Error).message);})
   .finally(()=>{if(!controller.signal.aborted)setMappingLoading(false);});
  return ()=>controller.abort();
 },[item.id,initialMappingSearch]);
 const filteredMappings=useMemo(()=>mappings.filter(m=>
  (mappingStatus==="ALL"||m.status===mappingStatus)
  &&(!mappingSearch||[m.externalId,m.channelName??""].join(" ")
   .toLocaleLowerCase().includes(mappingSearch.toLocaleLowerCase()))),
  [mappings,mappingStatus,mappingSearch]);
 const orderedMappings=useMemo(()=>sortTvRows(filteredMappings,mappingSort,(m,key)=>{
  if(key==="external")return m.externalId;
  if(key==="channel")return availableChannels.find(ch=>ch.id===(selection[m.id]??m.channelId))?.name??m.channelName;
  return null;
 }),[filteredMappings,mappingSort,availableChannels,selection]);
 const mappingPages=Math.max(1,Math.ceil(orderedMappings.length/15));
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
   const channel=availableChannels.find(x=>x.id===channelId);
   setMappings(previous=>previous.map(x=>x.id===mapping.id
    ?{...x,status,channelId:status==="VERIFIED"?channelId:null,
       channelName:status==="VERIFIED"?channel?.name??null:null}:x));
  }catch(err){setMappingError((err as Error).message);}
  finally{setMappingBusy("");}
 }
 async function createChannel(){
  if(!creatingFor||!newChannelCountry||!newChannelName.trim()||mappingBusy)return;
  const target=creatingFor;
  const country=countries.find(c=>c.id===newChannelCountry);
  if(!country)return;
  setMappingBusy(target.id);setMappingError("");
  try{
   // Unique deterministic slug scoped to the source external mapping.
   // The name remains editable; no guessed country assignment is made.
   const slug="epg-"+target.id.replaceAll("-","").slice(0,24);
   const response=await fetch("/api/admin/tv/catalog/channels/discover",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({countryId:country.id,slug,name:newChannelName.trim()}),
   });
   if(!response.ok)throw new Error(await describeSaveError(response));
   const created=await response.json() as {
    channelId:string;discoveredAssociations:{id:string}[];
   };
   const association=created.discoveredAssociations[0];
   if(!association)throw new Error(
    "La chaîne existe déjà. Vérifie son rattachement dans l’onglet Chaînes.");
   const variantResponse=await fetch("/api/admin/tv/catalog/variants",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({channelId:created.channelId,channelCountryId:association.id,
     code:"main-"+country.code.toLowerCase(),name:newChannelName.trim(),
     timezone:country.timezone}),
   });
   if(!variantResponse.ok)throw new Error(await describeSaveError(variantResponse));
   setAvailableChannels(prev=>[...prev,{id:created.channelId,
    name:newChannelName.trim(),countryId:country.id,countryLabel:country.name,
    defaultVariantId:null}]);
   setSelection(prev=>({...prev,[target.id]:created.channelId}));
   setCreatingFor(null);
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
    <div className={styles.formGrid}>
     <label>Périmètre du flux
      <select className="form-select" value={geographicScope}
       onChange={e=>setGeographicScope(e.target.value as "GLOBAL"|"COUNTRY")}>
       <option value="GLOBAL">Global — plusieurs pays dans le flux</option>
       <option value="COUNTRY">Un seul pays</option>
      </select>
     </label>
     {geographicScope==="COUNTRY"&&<label>Pays du flux
      <select className="form-select" value={scopeCountryId}
       onChange={e=>setScopeCountryId(e.target.value)}>
       <option value="">Sélectionner un pays</option>
       {countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
     </label>}
    </div>
    <p className="small text-body-secondary">
     {geographicScope==="GLOBAL"
      ?"Chaque chaîne est rattachée au pays indiqué par son attribut XMLTV country. Sans cet attribut, elle reste à classer."
      :"Toutes les chaînes découvertes dans ce flux sont rattachées au pays sélectionné, mais restent inactives et à vérifier."}
    </p>
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
    <button type="button" className="btn btn-primary mt-3" disabled={busy||!name.trim()||!url.trim()||(geographicScope==="COUNTRY"&&!scopeCountryId)}
     onClick={()=>void save("configuration",{name,sourceUrl:url,format,isActive:active,
       geographicScope,scopeCountryId:geographicScope==="COUNTRY"?scopeCountryId:null,
       expectedVersion:item.version},
      "Configuration enregistrée.")}>Enregistrer la configuration</button>
   </fieldset>
   <fieldset>
    <legend className="h5">Droits de republication</legend>
    <p className="small text-body-secondary">Indiquez votre décision pour chaque type de contenu. Une autorisation peut être enregistrée sans justificatif, mais une référence vérifiable est nécessaire pour importer les programmes sous licence et pour toute republication ultérieure.</p>
    {rightKeys.map(k=><div className="mb-3" key={k}>
     <label className="form-label" htmlFor={"right-"+k}>{readable[k]}</label>
     <select className="form-select" id={"right-"+k} value={rights[k].status}
      onChange={e=>setRights(old=>({...old,[k]:{...old[k],status:e.target.value}}))}>
      {rightOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
     </select>
     <label className="form-label small mt-2" htmlFor={"right-ref-"+k}>
      Référence de droits (URL, licence ou justificatif)
     </label>
     <input id={"right-ref-"+k} className="form-control form-control-sm"
      maxLength={2048} value={rights[k].reference}
      placeholder="Référence vérifiable, nécessaire pour l’import autorisé"
      onChange={e=>setRights(old=>({...old,[k]:{...old[k],reference:e.target.value}}))}/>
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
     {creatingFor&&<div className="border rounded p-3 mb-3">
      <strong>Créer une chaîne dans le catalogue</strong>
      <p className="small text-body-secondary mb-2">
       Identifiant EPG : {creatingFor.externalId}. La chaîne sera inactive et à vérifier ;
       aucun programme ne sera publié automatiquement.
      </p>
      <label className="form-label d-block">Nom
       <input className="form-control" value={newChannelName}
        onChange={e=>setNewChannelName(e.target.value)} maxLength={255}/>
      </label>
      <label className="form-label d-block">Pays de diffusion
       <select className="form-select" value={newChannelCountry}
        onChange={e=>setNewChannelCountry(e.target.value)}>
        {countries.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
       </select>
      </label>
      <div className="d-flex gap-2 mt-2">
       <button type="button" className="btn btn-primary btn-sm"
        disabled={!!mappingBusy||!newChannelName.trim()||!newChannelCountry}
        onClick={()=>void createChannel()}>Créer la chaîne</button>
       <button type="button" className="btn btn-outline-secondary btn-sm"
        onClick={()=>setCreatingFor(null)}>Annuler</button>
      </div>
     </div>}
     {availableChannels.length===0&&<p className="alert alert-info">
      Aucune chaîne n’est encore dans le catalogue. Crée une chaîne depuis
      un identifiant EPG ci-dessous, puis valide sa correspondance.
     </p>}
     <div className="table-responsive">
      <table className="table align-middle">
       <thead><tr>
        <TvSortableHeader label="ID externe" sortKey="external" sort={mappingSort} onSort={toggleMappingSort}/>
        <TvSortableHeader label="Chaîne LMN24" sortKey="channel" sort={mappingSort} onSort={toggleMappingSort}/>
        <th>Action</th></tr></thead>
       <tbody>{orderedMappings.slice((mappingPage-1)*15,mappingPage*15)
        .map(m=><tr key={m.id}>
         <td><code>{m.externalId}</code><div className="small text-body-secondary">{m.status}</div></td>
         <td><select className="form-select form-select-sm"
          aria-label={"Chaîne LMN24 pour "+m.externalId}
          disabled={!!mappingBusy}
          value={selection[m.id]??m.channelId??""}
          onChange={e=>setSelection(prev=>({...prev,[m.id]:e.target.value}))}>
          <option value="">Sélectionner une chaîne</option>
          {availableChannels.map(ch=><option key={ch.countryId+ch.id} value={ch.id}>
           {ch.countryLabel} · {ch.name}</option>)}
         </select></td>
         <td><div className="d-flex gap-1">
          <button className="btn btn-sm btn-outline-primary" type="button"
           disabled={!!mappingBusy||!(selection[m.id]??m.channelId)}
           onClick={()=>void reviewMapping(m,"VERIFIED")}>Valider</button>
          <button className="btn btn-sm btn-outline-secondary" type="button"
           disabled={!!mappingBusy} onClick={()=>void reviewMapping(m,"REJECTED")}>Rejeter</button>
          <button className="btn btn-sm btn-outline-secondary" type="button"
           disabled={!!mappingBusy} onClick={()=>{
            setCreatingFor(m);
            setNewChannelName(m.externalId.slice(0,255));
           }}>Créer une chaîne</button>
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
