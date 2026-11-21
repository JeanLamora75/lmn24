"use client";
import {useEffect,useMemo,useState} from "react";
import {AdminDataPanel,AdminFilterPanel} from "@/components/admin/AdminWorkspace";
import {AdminIconButton} from "@/components/admin/AdminIcon";

type Provider={id:string;providerType:string;isActive:boolean;isSelected:boolean;
 freeApproved:boolean;rightsReviewed:boolean};
type Description={languageCode:string;content:string;origin:string;version:string};
type Channel={channelId:string;name:string};
type LanguageStatus={language:string;status:string;description:Description|null};
type Preview={status:"READY"|"PARTIAL"|"COMPLETE";previewId:string|null;
 translated:Record<string,string>;failed:string[];unsupported:string[];missing:string[]};
type PreviewJob={channel:string;sourceLanguage:string;nonce:number};
const langs=["fr","en","de","es","pt","it","ru","nl"] as const;
const root="/api/admin/tv/translations/";
async function call<T>(path:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(root+path,{cache:"no-store",method,signal:signal??null,
  headers:body===undefined?{}:{"content-type":"application/json"},
  body:body===undefined?null:JSON.stringify(body)});
 if(!response.ok)throw new Error(response.status===409?
  "Modification concurrente, prévisualisation expirée ou fournisseur modifié. Actualisez avant de recommencer.":
  response.status===503?"Traduction indisponible : fournisseur ou adaptateur non activé.":
  response.status===401?"Session expirée : reconnectez-vous.":
  response.status===403?"Accès refusé.":"Opération impossible. Consultez la configuration et réessayez.");
 return await response.json() as T;
}
export function TvTranslationPanel({channels}:{channels:Channel[]}){
 const [providers,setProviders]=useState<Provider[]>([]);
 const [channel,setChannel]=useState("");
 const [descriptions,setDescriptions]=useState<Description[]>([]);
 const [statuses,setStatuses]=useState<LanguageStatus[]>([]);
 const [language,setLanguage]=useState<(typeof langs)[number]>("fr");
 const [sourceLanguage,setSourceLanguage]=useState<(typeof langs)[number]>("fr");
 const [value,setValue]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [reload,setReload]=useState(0);
 const [busy,setBusy]=useState(false);
 const [job,setJob]=useState<PreviewJob|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [accepted,setAccepted]=useState<string[]>([]);
 const [previewError,setPreviewError]=useState("");
 const [previewBusy,setPreviewBusy]=useState(false);
 const existing=useMemo(()=>descriptions.find(d=>d.languageCode===language),[descriptions,language]);
 const chosenProvider=providers.find(p=>p.isSelected);
 const selectedName=channels.find(c=>c.channelId===channel)?.name??"";
 function invalidatePreview(){
  setJob(null);setPreview(null);setAccepted([]);setPreviewError("");setPreviewBusy(false);
 }
 useEffect(()=>{
  const ctrl=new AbortController();
  call<{items:Provider[]}>("providers","GET",undefined,ctrl.signal).then(x=>{
   if(!ctrl.signal.aborted)setProviders(x.items);
  }).catch(e=>{if(!ctrl.signal.aborted)setError((e as Error).message);});
  return ()=>ctrl.abort();
 },[reload]);
 useEffect(()=>{
  if(!channel)return;
  const ctrl=new AbortController();
  Promise.all([
   call<{items:Description[]}>("channels/"+channel+"/descriptions","GET",undefined,ctrl.signal),
   call<{items:LanguageStatus[]}>("channels/"+channel+"/statuses","GET",undefined,ctrl.signal),
  ]).then(([d,s])=>{
   if(!ctrl.signal.aborted){setDescriptions(d.items);setStatuses(s.items);}
  }).catch(e=>{if(!ctrl.signal.aborted)setError((e as Error).message);});
  return ()=>ctrl.abort();
 },[channel,reload]);
 useEffect(()=>{
  if(!job||job.channel!==channel||job.sourceLanguage!==sourceLanguage)return;
  const ctrl=new AbortController();
  call<Preview>("channels/"+job.channel+"/preview","POST",
    {sourceLanguage:job.sourceLanguage},ctrl.signal).then(result=>{
    if(ctrl.signal.aborted)return;
    setPreview(result);setAccepted(Object.keys(result.translated));setPreviewError("");
  }).catch(e=>{
    if(!ctrl.signal.aborted){setPreviewError((e as Error).message);setPreview(null);}
  }).finally(()=>{if(!ctrl.signal.aborted)setPreviewBusy(false);});
  return ()=>ctrl.abort();
 },[job,channel,sourceLanguage]);
 async function select(item:Provider){
  if(busy||!window.confirm("Sélectionner "+item.providerType+
    " ? Les traductions enregistrées resteront inchangées."))return;
  setBusy(true);setError("");invalidatePreview();
  try{await call("providers/"+item.id+"/select","PATCH",{});
   setNotice("Fournisseur sélectionné manuellement.");setReload(v=>v+1);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function register(){
  if(busy||!window.confirm("Enregistrer un adaptateur local non activé, en attente de vérification des droits et de la gratuité ?"))return;
  setBusy(true);setError("");invalidatePreview();
  try{await call("providers","POST",{});
   setNotice("Adaptateur enregistré inactif, sans présumer de sa conformité.");setReload(v=>v+1);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function edit(){
  if(!channel||busy)return;
  setBusy(true);setError("");invalidatePreview();
  try{await call("channels/"+channel+"/descriptions/"+language,"PUT",{
   content:value,expectedVersion:existing?.version??null,
  });
   setNotice("Description manuelle enregistrée, sans effacer les autres langues.");
   setValue("");setReload(v=>v+1);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function startPreview(){
  if(previewBusy||busy||!channel||!chosenProvider)return;
  setPreview(null);setAccepted([]);setPreviewError("");setPreviewBusy(true);
  setJob({channel,sourceLanguage,nonce:Date.now()});
 }
 async function approve(){
  if(!channel||!preview?.previewId||!accepted.length||busy)return;
  if(!window.confirm("Enregistrer uniquement les "+accepted.length+
    " traductions sélectionnées ? Aucune description existante ne sera remplacée."))return;
  setBusy(true);setError("");
  try{
   const result=await call<{saved:string[];conflicts:string[];status:string}>(
    "channels/"+channel+"/approve","POST",{previewId:preview.previewId,languages:accepted});
   setNotice(result.saved.length+" langue(s) ajoutée(s)."+
     (result.conflicts.length?" "+result.conflicts.length+" langue(s) protégée(s) car déjà renseignée(s).":""));
   invalidatePreview();setReload(v=>v+1);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function switchChannel(id:string){
  invalidatePreview();setChannel(id);setDescriptions([]);setStatuses([]);setValue("");
 }
 return <div className="d-grid gap-3">
  {error&&<div role="alert" className="alert alert-danger">{error}
   <button type="button" className="btn btn-outline-danger ms-2" onClick={()=>setReload(v=>v+1)}>Réessayer</button></div>}
  {notice&&<p role="status" className="alert alert-info">{notice}</p>}
  <AdminDataPanel label="Fournisseurs de traduction">
   <div className="p-3">
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
     <h2 className="h5">Fournisseurs</h2>
     <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={()=>void register()}>
      Ajouter un adaptateur local (inactif)</button>
    </div>
    <p className="text-body-secondary">Aucun fournisseur n'est activé sur sa seule déclaration de gratuité.
     Il doit être vérifié comme totalement gratuit, sans carte bancaire ni facturation, et autorisé pour la republication.
     L’adaptateur doit être installé localement par l’exploitant. Aucun secret ni suivi de quota n’est affiché.</p>
    <div className="table-responsive"><table className="table">
     <thead><tr><th>Fournisseur</th><th>Gratuité vérifiée</th><th>Droits</th><th>État</th><th>Action</th></tr></thead>
     <tbody>{providers.map(p=><tr key={p.id}>
      <td>{p.providerType}</td><td>{p.freeApproved?"Oui":"Non"}</td>
      <td>{p.rightsReviewed?"Vérifiés":"À vérifier"}</td>
      <td>{p.isSelected?"Sélectionné":p.isActive?"Actif":"Inactif"}</td>
      <td><AdminIconButton name="check-circle" label={"Sélectionner "+p.providerType}
       disabled={busy||p.isSelected||!p.isActive||!p.freeApproved||!p.rightsReviewed}
       onClick={()=>void select(p)}/></td>
     </tr>)}</tbody>
    </table></div>
    {providers.length===0&&<p>Aucun fournisseur configuré.</p>}
   </div>
  </AdminDataPanel>
  <AdminFilterPanel title="Choisir une chaîne et une langue">
   <div className="row g-3">
    <label className="col-12 col-md-6">Chaîne
     <select className="form-select" value={channel} onChange={e=>switchChannel(e.target.value)}>
      <option value="">Choisir une chaîne</option>
      {[...new Map(channels.map(c=>[c.channelId,c])).values()].map(v=>
       <option key={v.channelId} value={v.channelId}>{v.name}</option>)}
     </select></label>
    <label className="col-12 col-md-6">Langue à éditer manuellement
     <select className="form-select" value={language} onChange={e=>{
      setLanguage(e.target.value as typeof language);setValue("");invalidatePreview();
     }}>{langs.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
    </label>
   </div>
  </AdminFilterPanel>
  {channel&&<AdminDataPanel label="Descriptions multilingues">
   <div className="p-3">
    <h2 className="h5">{selectedName} — huit langues</h2>
    <div className="row g-2 mb-3">{langs.map(l=><div className="col-6 col-lg-3" key={l}>
     <div className="border rounded p-2"><strong>{l.toUpperCase()}</strong>
      <div className="small">{statuses.find(s=>s.language===l)?.status??
        (descriptions.find(d=>d.languageCode===l)?.origin??"MISSING")}</div>
     </div></div>)}</div>
    <p>Description enregistrée ({language.toUpperCase()}, {existing?.origin??"MISSING"}) :</p>
    <p className="p-2 border rounded">{existing?.content??"Aucune description."}</p>
    <label htmlFor="tv-manual-description" className="form-label">Nouvelle description manuelle</label>
    <textarea id="tv-manual-description" className="form-control" rows={5}
     value={value} onChange={e=>{setValue(e.target.value);invalidatePreview();}} maxLength={10000}/>
    <p className="small text-body-secondary">Une modification manuelle invalide l’aperçu en cours.
     Une erreur 409 empêche d’écraser une version plus récente.</p>
    <button type="button" className="btn btn-primary" disabled={!value.trim()||busy}
     onClick={()=>void edit()}>Enregistrer la description manuelle</button>
   </div>
  </AdminDataPanel>}
  {channel&&<AdminDataPanel label="Traductions proposées">
   <div className="p-3">
    <h2 className="h5">Prévisualiser les langues manquantes ou échouées</h2>
    <p>Les descriptions déjà présentes, y compris SOURCE, TRANSLATED et MANUAL,
     ne seront jamais remplacées automatiquement. Les langues non prises en charge seront signalées.</p>
    <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
     <label>Langue du texte source
      <select className="form-select" value={sourceLanguage}
       onChange={e=>{invalidatePreview();setSourceLanguage(e.target.value as typeof sourceLanguage);}}>
       {langs.map(l=><option value={l} key={l}>{l.toUpperCase()}</option>)}
      </select></label>
     <button type="button" className="btn btn-outline-primary"
      disabled={!chosenProvider||busy||previewBusy||!descriptions.some(d=>d.languageCode===sourceLanguage)}
      onClick={startPreview}>{previewBusy?"Traduction en cours…":"Prévisualiser les traductions"}</button>
    </div>
    {!chosenProvider&&<p className="alert alert-warning">Aucun fournisseur approuvé et sélectionné : traduction automatique indisponible.</p>}
    {previewError&&<p role="alert" className="alert alert-danger">{previewError}</p>}
    {preview&&<div aria-live="polite">
     <p>Résultat : {preview.status}. {preview.failed.length} échec(s),
      {preview.unsupported.length} langue(s) non prise(s) en charge.</p>
     {preview.failed.length>0&&<p>Échecs : {preview.failed.join(", ").toUpperCase()}.
      Une relance utilisera le fournisseur sélectionné manuellement, sans effacer les succès.</p>}
     {Object.entries(preview.translated).map(([lang,text])=>
      <label className="d-block border rounded p-2 mb-2" key={lang}>
       <input type="checkbox" className="form-check-input me-2"
        checked={accepted.includes(lang)} onChange={e=>setAccepted(previous=>
         e.target.checked?[...previous,lang]:previous.filter(v=>v!==lang))}/>
       <strong>{lang.toUpperCase()} — proposition, non enregistrée</strong>
       <p className="mt-2 mb-0">{text}</p>
      </label>)}
     {preview.previewId&&<button type="button" className="btn btn-primary"
      disabled={busy||accepted.length===0} onClick={()=>void approve()}>
      Valider les traductions sélectionnées</button>}
     {preview.status==="COMPLETE"&&<p>Aucune langue manquante ou échouée éligible à une relance.</p>}
    </div>}
   </div>
  </AdminDataPanel>}
 </div>;
}
