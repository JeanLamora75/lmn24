"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

type TvRun={
 id:string;trigger:"MANUAL"|"AUTOMATIC";requestedDays:number;
 status:"QUEUED"|"RUNNING"|"SUCCESS"|"PARTIAL"|"ERROR"|"INTERRUPTED";
 createdAt:string;startedAt:string|null;finishedAt:string|null;
 scopeCount:number;succeeded:number;failed:number;
};
type Listing={items:TvRun[];pagination:{page:number;pageSize:number;total:number;totalPages:number}};
type TvStatus="ALL"|TvRun["status"];
const statusText:Record<TvRun["status"],string>={
 QUEUED:"En attente",RUNNING:"En cours",SUCCESS:"Succès",
 PARTIAL:"Partiel",ERROR:"Erreur",INTERRUPTED:"Interrompu",
};
function dateText(value:string|null):string{
 if(!value)return "—";
 const d=new Date(value);
 return Number.isFinite(d.getTime())
  ?d.toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"medium"}):"—";
}
export function TvMonitoringPanel({visible,period,from,to}:{
 visible:boolean;period:"24h"|"7d"|"30d"|"custom";from:string;to:string;
}){
 const [data,setData]=useState<Listing|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [page,setPage]=useState(1);
 const [status,setStatus]=useState<TvStatus>("ALL");
 const [revision,setRevision]=useState(0);
 const [detail,setDetail]=useState<TvRun|null>(null);
 const [events,setEvents]=useState<Array<{id:string;occurredAt:string;eventType:string;message:string}>>([]);
 const range=useMemo(()=>{
  const now=Date.now();
  if(period==="custom"){
   const lo=from?Date.parse(from+"T00:00:00Z"):NaN;
   const hi=to?Date.parse(to+"T23:59:59.999Z"):NaN;
   return {lo,hi};
  }
  return {lo:now-(period==="24h"?1:period==="7d"?7:30)*86_400_000,hi:now};
 },[period,from,to]);
 useEffect(()=>{
  if(!visible||!Number.isFinite(range.lo)||!Number.isFinite(range.hi))return;
  const abort=new AbortController();
  const timer=window.setTimeout(()=>{
   setLoading(true);setError("");
   void fetch("/api/admin/tv/import-runs?page=1&pageSize=100",{cache:"no-store",signal:abort.signal})
    .then(async response=>{
     if(!response.ok)throw new Error("Historique Guide TV indisponible ("+response.status+").");
     return response.json() as Promise<Listing>;
    }).then(result=>{if(!abort.signal.aborted)setData(result);})
    .catch(err=>{if(!abort.signal.aborted)setError(err instanceof Error?err.message:"Erreur de consultation.");})
    .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  },0);
  return()=>{window.clearTimeout(timer);abort.abort();};
 },[visible,revision,range.lo,range.hi]);
 useEffect(()=>{
  if(!visible)return;
  const timer=window.setInterval(()=>{
   if(document.visibilityState==="visible")setRevision(n=>n+1);
  },30_000);
  return()=>window.clearInterval(timer);
 },[visible]);
 useEffect(()=>{
  if(!visible||!detail)return;
  const abort=new AbortController();
  void fetch("/api/admin/tv/import-runs/"+encodeURIComponent(detail.id)+"/events",
    {cache:"no-store",signal:abort.signal})
   .then(response=>response.ok?response.json():Promise.reject(new Error("Événements indisponibles")))
   .then((body:{items:typeof events})=>{if(!abort.signal.aborted)setEvents(body.items);})
   .catch(()=>{if(!abort.signal.aborted)setEvents([]);});
  return()=>abort.abort();
 },[visible,detail]);
 const filtered=(data?.items??[]).filter(r=>{
  const t=Date.parse(r.createdAt);
  return t>=range.lo&&t<=range.hi&&(status==="ALL"||r.status===status);
 });
 const total=data?.pagination.total??0;
 const shown=filtered.slice((page-1)*20,page*20);
 const completed=filtered.filter(r=>["SUCCESS","PARTIAL","ERROR","INTERRUPTED"].includes(r.status));
 const success=filtered.filter(r=>r.status==="SUCCESS");
 if(!visible)return null;
 return <section className="card shadow-sm mb-4 lmn-admin-form-surface" aria-labelledby="tv-monitor-title">
  <div className="card-body p-4">
   <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
    <div>
     <h2 className="h4 mb-1" id="tv-monitor-title">Parser Guide TV</h2>
     <p className="text-body-secondary small mb-0">Historique des imports EPG manuels et automatiques, distinct des collectes Infos, Vidéos et Météo.</p>
    </div>
    <Link href="/admin/tv/imports" className="btn btn-sm btn-outline-primary">Gérer les imports TV</Link>
   </div>
   <div className="row g-3 mb-3">
    <div className="col-12 col-md-3">
     <label htmlFor="tv-monitor-status" className="form-label">Statut des imports TV</label>
     <select id="tv-monitor-status" className="form-select" value={status}
      onChange={e=>{setStatus(e.target.value as TvStatus);setPage(1);}}>
      <option value="ALL">Tous les statuts</option>
      {(Object.keys(statusText) as TvRun["status"][]).map(s=>
       <option key={s} value={s}>{statusText[s]}</option>)}
     </select>
    </div>
    <div className="col-12 col-md-auto d-flex align-items-end">
     <button type="button" className="btn btn-primary" onClick={()=>setRevision(n=>n+1)}
      disabled={loading}>{loading?"Chargement…":"Actualiser"}</button>
    </div>
   </div>
   {error&&<p role="alert" className="alert alert-warning">{error}</p>}
   <div className="row g-3 mb-3">
    {([
     ["Exécutions",filtered.length],
     ["Automatiques",filtered.filter(r=>r.trigger==="AUTOMATIC").length],
     ["Succès",success.length],
     ["Erreurs",filtered.filter(r=>["ERROR","INTERRUPTED"].includes(r.status)).length],
    ] as const).map(([label,value])=>
     <div key={label} className="col-6 col-lg-3">
      <div className="border rounded p-3 h-100">
       <p className="small text-body-secondary mb-1">{label}</p>
       <strong className="h4">{value.toLocaleString("fr-FR")}</strong>
      </div>
     </div>)}
   </div>
   <p className="small text-body-secondary">
    {completed.length} exécutions terminées sur la période. Les statistiques
    portent sur les {data?.items.length??0} derniers imports récupérés
    {total>(data?.items.length??0)?" (historique plus ancien non inclus)":""}.
   </p>
   <div className="table-responsive">
    <table className="table table-hover align-middle">
     <thead><tr><th>Date</th><th>Déclencheur</th><th>Statut</th>
      <th>Jours</th><th>Périmètres</th><th>Succès</th><th>Échecs</th><th>Actions</th></tr></thead>
     <tbody>{shown.map(run=><tr key={run.id}>
      <td>{dateText(run.createdAt)}</td>
      <td>{run.trigger==="AUTOMATIC"?"Automatique":"Manuel"}</td>
      <td>{statusText[run.status]}</td>
      <td>{run.requestedDays}</td><td>{run.scopeCount}</td>
      <td>{run.succeeded}</td><td>{run.failed}</td>
      <td><button type="button" className="btn btn-sm btn-outline-primary"
       onClick={()=>{setDetail(run);setEvents([]);}}>Détails</button></td>
     </tr>)}
      {!shown.length&&<tr><td colSpan={8}>Aucun import TV pour les filtres sélectionnés.</td></tr>}
     </tbody>
    </table>
   </div>
   {filtered.length>20&&<div className="d-flex align-items-center gap-3">
     <button className="btn btn-sm btn-outline-secondary" disabled={page===1}
      onClick={()=>setPage(p=>Math.max(1,p-1))}>Précédent</button>
     <span>Page {page} / {Math.ceil(filtered.length/20)}</span>
     <button className="btn btn-sm btn-outline-secondary"
      disabled={page*20>=filtered.length} onClick={()=>setPage(p=>p+1)}>Suivant</button>
    </div>}
   {detail&&<div className="border rounded p-3 mt-3">
     <div className="d-flex justify-content-between align-items-center gap-2">
      <h3 className="h6 mb-0">Événements de l'import du {dateText(detail.createdAt)}</h3>
      <button type="button" className="btn btn-sm btn-outline-secondary"
       onClick={()=>setDetail(null)}>Fermer</button>
     </div>
     <ul className="list-group list-group-flush mt-2">
      {events.slice(0,30).map(e=><li className="list-group-item" key={e.id}>
       <span className="text-body-secondary me-2">{dateText(e.occurredAt)}</span>
       <strong>{e.eventType}</strong> — {e.message}
      </li>)}
      {!events.length&&<li className="list-group-item">Aucun événement disponible.</li>}
     </ul>
    </div>}
  </div>
 </section>;
}
