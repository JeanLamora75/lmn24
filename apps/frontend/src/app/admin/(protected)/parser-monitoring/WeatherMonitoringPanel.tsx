"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";

type WeatherStatus="ALL"|"RUNNING"|"SUCCESS"|"PARTIAL"|"ERROR"|"INTERRUPTED";
type WeatherContinent="ALL"|"EU"|"AS"|"AF"|"NA"|"SA"|"OC";
type WeatherRun={
  id:string;trigger:string;continentCode:WeatherContinent|null;
  startedAt:string;finishedAt:string|null;status:Exclude<WeatherStatus,"ALL">;
  totalCities:number;processedCities:number;successfulCities:number;
  failedCities:number;errorMessage:string|null;
};
type WeatherData={
  activeCities:number;currentPresent:number;freshCities:number;staleCities:number;
  staleAfterMinutes:number;executions:number;succeeded:number;partial:number;
  failed:number;running:number;processedCities:number;successfulCities:number;
  failedCities:number;averageDurationMs:number|null;
  durationSampleTruncated:boolean;lastStarted:string|null;lastSuccess:string|null;
  alerts:Array<{type:string;message:string;at:string}>;
  rows:WeatherRun[];
  pagination:{page:number;pageSize:number;total:number;totalPages:number};
};
const CONTINENTS:Record<WeatherContinent,string>={
  ALL:"Tous les continents",EU:"Europe",AS:"Asie",AF:"Afrique",
  NA:"Amérique du Nord",SA:"Amérique du Sud",OC:"Océanie",
};
const STATES:Record<WeatherStatus,string>={
  ALL:"Tous les statuts",RUNNING:"En cours",SUCCESS:"Succès",
  PARTIAL:"Partiel",ERROR:"Erreur",INTERRUPTED:"Interrompu",
};
function formatDate(value:string|null){
  if(!value)return "—";
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"medium"}):"—";
}
function formatDuration(value:number|null){
  if(value===null)return "—";
  return value<1000?value+" ms":(value/1000).toFixed(1)+" s";
}
function Stat({label,value,hint}:{label:string;value:number|string;hint:string}){
  return <div className="col-6 col-lg-4 col-xxl-3">
    <div className="border rounded p-3 h-100">
      <div className="text-body-secondary small">{label}</div>
      <div className="h4 mb-0">{typeof value==="number"?value.toLocaleString("fr-FR"):value}</div>
      <div className="small text-body-secondary">{hint}</div>
    </div>
  </div>;
}

export function WeatherMonitoringPanel({period,from,to,visible}:{
  period:"24h"|"7d"|"30d"|"custom";from:string;to:string;visible:boolean;
}){
  const [continent,setContinent]=useState<WeatherContinent>("ALL");
  const [status,setStatus]=useState<WeatherStatus>("ALL");
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(20);
  const [data,setData]=useState<WeatherData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<WeatherRun|null>(null);
  const [revision,setRevision]=useState(0);
  const validDates=period!=="custom"||(Boolean(from)&&Boolean(to));
  const query=useMemo(()=>{
    const q=new URLSearchParams({period,status,continent,page:String(page),pageSize:String(pageSize)});
    if(period==="custom"){if(from)q.set("from",from);if(to)q.set("to",to);}
    return q.toString();
  },[period,status,continent,page,pageSize,from,to]);
  const refresh=useCallback(async(signal:AbortSignal)=>{
    if(!validDates)return;
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/parser-monitoring/weather?"+query,
        {cache:"no-store",signal});
      if(!response.ok){
        const body=await response.json().catch(()=>null) as {message?:string}|null;
        throw new Error(body?.message??"Impossible de consulter la supervision météo.");
      }
      const result=await response.json() as WeatherData;
      if(!signal.aborted){setData(result);setSelected(current=>
        current?result.rows.find(run=>run.id===current.id)??current:null);}
    }catch(e){
      if(!signal.aborted)setError(e instanceof Error?e.message:"Supervision météo indisponible.");
    }finally{if(!signal.aborted)setLoading(false);}
  },[query,validDates]);
  useEffect(()=>{
    if(!visible||!validDates)return;
    const abort=new AbortController();
    const t=window.setTimeout(()=>void refresh(abort.signal),0);
    return ()=>{window.clearTimeout(t);abort.abort();};
  },[visible,validDates,revision,refresh]);
  useEffect(()=>{
    if(!visible)return;
    const interval=window.setInterval(()=>{
      if(document.visibilityState==="visible")setRevision(value=>value+1);
    },15000);
    return ()=>window.clearInterval(interval);
  },[visible]);
  if(!visible)return null;
  return <section className="card shadow-sm mb-4" aria-labelledby="weather-monitor-title">
    <div className="card-body p-4">
      <div className="d-flex justify-content-between flex-wrap align-items-center gap-2 mb-3">
        <div>
          <h2 id="weather-monitor-title" className="h4 mb-1">Parser Météo</h2>
          <p className="text-body-secondary small mb-0">
            Villes traitées, relevés récents et exécutions météo — distincts des flux Infos/Vidéos.
          </p>
        </div>
        <Link href="/admin/weather-parser" className="btn btn-sm btn-outline-primary">
          Lancer le Parser Météo
        </Link>
      </div>
      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-sm-6 col-xl-4">
          <label className="form-label" htmlFor="weather-monitor-continent">Continent météo</label>
          <select className="form-select" id="weather-monitor-continent" value={continent}
            onChange={e=>{setContinent(e.target.value as WeatherContinent);setPage(1);}}>
            {(Object.entries(CONTINENTS) as [WeatherContinent,string][])
              .map(([code,label])=><option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <label className="form-label" htmlFor="weather-monitor-status">Statut météo</label>
          <select className="form-select" id="weather-monitor-status" value={status}
            onChange={e=>{setStatus(e.target.value as WeatherStatus);setPage(1);}}>
            {(Object.entries(STATES) as [WeatherStatus,string][])
              .map(([code,label])=><option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div className="col-12 col-xl-4">
          <button className="btn btn-outline-secondary w-100" type="button"
            disabled={loading} onClick={()=>setRevision(v=>v+1)}>Actualiser les données météo</button>
        </div>
      </div>
      {!validDates&&<p className="text-body-secondary">
        Sélectionnez les deux dates de la période personnalisée.</p>}
      {error&&<div role="alert" className="alert alert-danger">{error}</div>}
      {loading&&!data&&<p className="text-body-secondary">Chargement météo…</p>}
      {data&&validDates&&<>
        <div className="row g-2 mb-3" aria-live="polite">
          <Stat label="Villes actives" value={data.activeCities}
            hint={data.currentPresent+" avec relevé"} />
          <Stat label="Météo récente" value={data.freshCities}
            hint={"Relevé de moins de "+data.staleAfterMinutes+" min"} />
          <Stat label="Météo absente ou ancienne" value={data.staleCities}
            hint="Villes nécessitant une collecte" />
          <Stat label="Lancements météo" value={data.executions}
            hint={data.running+" en cours · "+data.partial+" partiels"} />
          <Stat label="Villes traitées" value={data.processedCities}
            hint="Cumul sur la période filtrée" />
          <Stat label="Villes mises à jour" value={data.successfulCities}
            hint={data.failedCities+" échec(s) de villes"} />
          <Stat label="Exécutions réussies" value={data.succeeded}
            hint={data.failed+" en erreur/interrompues"} />
          <Stat label="Durée moyenne" value={formatDuration(data.averageDurationMs)}
            hint={data.durationSampleTruncated?"500 derniers runs maximum":"Lancements terminés"} />
        </div>
        <p className="small text-body-secondary mb-3">
          Dernier lancement : {formatDate(data.lastStarted)}
          {" · "}Dernier succès complet : {formatDate(data.lastSuccess)}.
          Les compteurs météo sont des villes, pas des flux RSS/YouTube.
        </p>
        {data.alerts.length>0&&<div className="mb-4">
          <h3 className="h6">Alertes météo</h3>
          {data.alerts.map(alert=><div key={alert.type}
            className="alert alert-warning py-2 mb-2" role="status">
            {alert.message}
          </div>)}
        </div>}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h3 className="h5 mb-0">Historique des collectes météo</h3>
          <label className="small">Résultats / page{" "}
            <select className="form-select form-select-sm d-inline-block w-auto"
              value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>
              <option>20</option><option>50</option><option>100</option>
            </select>
          </label>
        </div>
        {data.rows.length===0?<p className="text-body-secondary">Aucune exécution météo dans cette sélection.</p>
          :<div className="table-responsive"><table className="table table-sm table-hover align-middle">
            <thead><tr><th>Début</th><th>Continent</th><th>Origine</th>
              <th>État</th><th>Villes traitées</th><th>Réussies</th>
              <th>Échecs</th><th>Durée</th><th>Action</th></tr></thead>
            <tbody>{data.rows.map(run=><tr key={run.id}>
              <td className="text-nowrap">{formatDate(run.startedAt)}</td>
              <td>{CONTINENTS[run.continentCode??"ALL"]}</td>
              <td>{run.trigger==="MANUAL"?"Manuel":"Automatique"}</td>
              <td><span className={"badge "+(run.status==="SUCCESS"?"text-bg-success":
                run.status==="ERROR"?"text-bg-danger":run.status==="PARTIAL"?
                  "text-bg-warning":run.status==="RUNNING"?"text-bg-primary":"text-bg-secondary")}>
                  {STATES[run.status]}</span></td>
              <td>{run.processedCities}/{run.totalCities}</td>
              <td>{run.successfulCities}</td><td>{run.failedCities}</td>
              <td>{formatDuration(run.finishedAt?
                new Date(run.finishedAt).getTime()-new Date(run.startedAt).getTime():null)}</td>
              <td><button className="btn btn-sm btn-outline-primary" type="button"
                onClick={()=>setSelected(run)}>Détails</button></td>
            </tr>)}</tbody>
          </table></div>}
        <div className="d-flex gap-2 justify-content-end mb-3">
          <button className="btn btn-sm btn-outline-secondary" disabled={page<=1}
            onClick={()=>setPage(p=>p-1)}>Précédent</button>
          <span className="small align-self-center">{page}/{Math.max(1,data.pagination.totalPages)}</span>
          <button className="btn btn-sm btn-outline-secondary"
            disabled={page>=data.pagination.totalPages}
            onClick={()=>setPage(p=>p+1)}>Suivant</button>
        </div>
        {selected&&<div className="border rounded p-3" role="region" aria-label="Détail du parser météo">
          <div className="d-flex justify-content-between mb-2">
            <h3 className="h6">Exécution météo : {STATES[selected.status]}</h3>
            <button className="btn-close" aria-label="Fermer le détail"
              onClick={()=>setSelected(null)} type="button"/>
          </div>
          <p className="small mb-2">ID : <code className="text-break">{selected.id}</code>
            {" · "}Début : {formatDate(selected.startedAt)}
            {" · "}Fin : {formatDate(selected.finishedAt)}</p>
          <p className="small mb-2">Villes prévues : {selected.totalCities}.
            Traitées : {selected.processedCities}.
            Réussies : {selected.successfulCities}.
            En erreur : {selected.failedCities}.</p>
          {selected.errorMessage&&<pre className="alert alert-danger text-wrap mb-0"
            style={{overflowWrap:"anywhere"}}>{selected.errorMessage}</pre>}
          {!selected.errorMessage&&<p className="small text-body-secondary mb-0">
            Aucun diagnostic d’erreur enregistré pour ce lancement.</p>}
        </div>}
      </>}
    </div>
  </section>;
}
