"use client";
import {useEffect,useMemo,useState} from "react";
import {AdminDataPanel,AdminFilterPanel} from "@/components/admin/AdminWorkspace";
import {AdminIconButton} from "@/components/admin/AdminIcon";
type Provider={id:string;providerType:string;isActive:boolean;isSelected:boolean;
 freeApproved:boolean;rightsReviewed:boolean};
type Description={languageCode:string;content:string;origin:string;version:string};
type Channel={channelId:string;name:string};
const langs=["fr","en","de","es","pt","it","ru","nl"] as const;
const root="/api/admin/tv/translations/";
async function call<T>(path:string,method="GET",body?:unknown):Promise<T>{
 const response=await fetch(root+path,{cache:"no-store",method,
  headers:body===undefined?undefined:{"content-type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw new Error(response.status===409?
  "Modification concurrente ou fournisseur non éligible ; actualisez.":
  response.status===503?"Module de traductions non configuré.":"Impossible de charger ou enregistrer les données.");
 return await response.json() as T;
}
export function TvTranslationPanel({channels}:{channels:Channel[]}){
 const [providers,setProviders]=useState<Provider[]>([]);
 const [channel,setChannel]=useState("");
 const [descriptions,setDescriptions]=useState<Description[]>([]);
 const [language,setLanguage]=useState<(typeof langs)[number]>("fr");
 const [value,setValue]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [reload,setReload]=useState(0);
 const [busy,setBusy]=useState(false);
 const existing=useMemo(()=>descriptions.find(d=>d.languageCode===language),[descriptions,language]);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch(root+"providers",{cache:"no-store",signal:ctrl.signal}).then(async response=>{
   if(!response.ok)throw new Error(response.status===503?"Fonction Traductions indisponible.":"Impossible de charger les fournisseurs.");
   return await response.json() as {items:Provider[]};
  }).then(x=>{if(!ctrl.signal.aborted)setProviders(x.items);}).catch(e=>{
   if(!ctrl.signal.aborted)setError((e as Error).message);
  });
  return ()=>ctrl.abort();
 },[reload]);
 useEffect(()=>{
  if(!channel)return;
  const ctrl=new AbortController();
  fetch(root+"channels/"+channel+"/descriptions",{signal:ctrl.signal,cache:"no-store"})
   .then(async response=>{
    if(!response.ok)throw new Error("Descriptions indisponibles.");
    return await response.json() as {items:Description[]};
   }).then(x=>{if(!ctrl.signal.aborted)setDescriptions(x.items);}).catch(e=>{
    if(!ctrl.signal.aborted)setError((e as Error).message);
   });
  return ()=>ctrl.abort();
 },[channel,reload]);
 const selectedName=channels.find(c=>c.channelId===channel)?.name??"";
 const select=async(item:Provider)=>{
  if(!window.confirm("Sélectionner "+item.providerType+" pour les prochaines traductions ? Les textes existants restent conservés."))return;
  if(busy)return;setBusy(true);setError("");
  try{await call("providers/"+item.id+"/select","PATCH",{});setNotice("Fournisseur sélectionné manuellement.");setReload(v=>v+1);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 const edit=async()=>{
  if(!channel||busy)return;setBusy(true);setError("");
  try{await call("channels/"+channel+"/descriptions/"+language,"PUT",{
   content:value,expectedVersion:existing?.version??null,
  });setNotice("Description manuelle enregistrée ; aucune traduction existante d'une autre langue n'a été supprimée.");
   setReload(v=>v+1);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 return <div className="d-grid gap-3">
  {error&&<div role="alert" className="alert alert-danger">{error}
   <button className="btn btn-outline-danger ms-2" onClick={()=>setReload(v=>v+1)}>Réessayer</button></div>}
  {notice&&<p role="status" className="alert alert-info">{notice}</p>}
  <AdminDataPanel label="Fournisseurs de traduction">
   <div className="p-3">
    <h2 className="h5">Fournisseur actif</h2>
    <p>Seuls les fournisseurs actifs, explicitement approuvés gratuits et dont les droits sont vérifiés peuvent être sélectionnés.
     Aucun basculement automatique, aucune clé API affichée.</p>
    <div className="table-responsive"><table className="table">
     <thead><tr><th>Fournisseur</th><th>Gratuité vérifiée</th><th>Droits</th><th>État</th><th>Action</th></tr></thead>
     <tbody>{providers.map(v=><tr key={v.id}>
      <td>{v.providerType}</td><td>{v.freeApproved?"Oui":"Non"}</td>
      <td>{v.rightsReviewed?"Vérifiés":"À vérifier"}</td>
      <td>{v.isSelected?"Sélectionné":v.isActive?"Actif":"Inactif"}</td>
      <td><AdminIconButton name="check-circle" label={"Sélectionner "+v.providerType}
       disabled={busy||v.isSelected||!v.isActive||!v.freeApproved||!v.rightsReviewed}
       onClick={()=>void select(v)}/></td>
     </tr>)}</tbody>
    </table></div>
    {providers.length===0&&<p>Aucun fournisseur configuré.</p>}
   </div>
  </AdminDataPanel>
  <AdminFilterPanel title="Choisir une chaîne et une langue">
   <div className="row g-3">
    <label className="col-12 col-md-6">Chaîne
     <select className="form-select" value={channel} onChange={e=>{setChannel(e.target.value);setDescriptions([]);setValue("");}}>
      <option value="">Choisir une chaîne</option>
      {[...new Map(channels.map(c=>[c.channelId,c])).values()].map(v=><option key={v.channelId} value={v.channelId}>{v.name}</option>)}
     </select></label>
    <label className="col-12 col-md-6">Langue
     <select className="form-select" value={language} onChange={e=>{
      setLanguage(e.target.value as typeof language);setValue("");
     }}>{langs.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
    </label>
   </div>
  </AdminFilterPanel>
  {channel&&<AdminDataPanel label="Descriptions manuelles">
   <div className="p-3">
    <h2 className="h5">{selectedName} — descriptions</h2>
    <ul>{langs.map(l=><li key={l}>{l.toUpperCase()} : {descriptions.find(x=>x.languageCode===l)?.origin??"MISSING"}</li>)}</ul>
    <p>Texte actuellement enregistré ({language.toUpperCase()}, {existing?.origin??"MISSING"}) :</p>
    <p className="p-2 border rounded">{existing?.content??"Aucune description."}</p>
    <label htmlFor="tv-manual-description" className="form-label">Nouvelle description manuelle</label>
    <textarea id="tv-manual-description" className="form-control" rows={5} value={value}
     onChange={e=>setValue(e.target.value)} maxLength={10000}/>
    <p className="small text-body-secondary">Une description existante est remplacée uniquement après votre action explicite.
     Une modification concurrente provoque une erreur 409. Les autres langues sont conservées.</p>
    <button type="button" className="btn btn-primary" onClick={()=>void edit()}
     disabled={!value.trim()||busy}>Enregistrer la description manuelle</button>
   </div>
  </AdminDataPanel>}
  <AdminDataPanel label="Traduction automatique">
   <p className="p-3">La génération automatique et la reprise des seules langues manquantes restent désactivées :
    aucun moteur d’appel IA externe qualifié n’a encore été raccordé à ce module.</p>
  </AdminDataPanel>
 </div>;
}
