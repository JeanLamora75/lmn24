"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {
  WEATHER_CONTINENTS,WEATHER_STATUS,WEATHER_STATUS_CLASS,
  weatherTargetCount,weatherProgress,weatherElapsed,
  type WeatherContinent,type WeatherRun,type City,
} from "./weather-parser.data";

const API="/api/admin/parser/weather-runs";
function fmt(date:string|null):string{
  if(!date)return "—";
  const parsed=new Date(date);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"medium"}):"—";
}
async function json<T>(url:string,init?:RequestInit):Promise<T>{
  const result=await fetch(url,{cache:"no-store",...init});
  const data:unknown=await result.json().catch(()=>null);
  if(result.status===401)throw new Error("SESSION_EXPIRED");
  if(!result.ok){
    const description=data&&typeof data==="object"&&"message" in data
      ? String(data.message):"Service du parser météo indisponible.";
    throw new Error(description);
  }
  return data as T;
}

export default function WeatherParserScreen(){
  const router=useRouter();
  const [cities,setCities]=useState<City[]>([]);
  const [runs,setRuns]=useState<WeatherRun[]>([]);
  const [continent,setContinent]=useState<WeatherContinent|"all">("all");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [starting,setStarting]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const loadRuns=useCallback(async()=>{
    try{
      const result=await json<{items:WeatherRun[]}>(API);
      setRuns(result.items);
      setError(current=>current==="Impossible de récupérer les exécutions météo."?"":current);
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){
        router.replace("/admin/login");return;
      }
      setError("Impossible de récupérer les exécutions météo.");
    }
  },[router]);

  useEffect(()=>{
    let active=true;
    void Promise.all([
      json<{items:City[]}>("/api/admin/weather-cities"),
      json<{items:WeatherRun[]}>(API)
    ]).then(([cityResult,runResult])=>{
      if(!active)return;
      setCities(cityResult.items);setRuns(runResult.items);setLoading(false);
    }).catch(e=>{
      if(!active)return;
      if(e instanceof Error&&e.message==="SESSION_EXPIRED")router.replace("/admin/login");
      else setError(e instanceof Error?e.message:"Chargement impossible.");
      setLoading(false);
    });
    const interval=setInterval(()=>{if(active)void loadRuns();},2500);
    return ()=>{active=false;clearInterval(interval);};
  },[router,loadRuns]);

  const activeRun=runs.find(run=>run.status==="RUNNING");
  const selectedRun=runs.find(run=>run.id===selectedId)??activeRun??runs[0]??null;
  const count=weatherTargetCount(cities,continent);
  const lastSuccess=useMemo(()=>runs.find(run=>run.status==="SUCCESS"),[runs]);

  async function start(){
    if(starting||activeRun||loading||count===0)return;
    setStarting(true);setError("");setMessage("");
    try{
      const result=await json<{runId:string;accepted:boolean}>(API,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(continent==="all"?{}:{continentCode:continent}),
      });
      setSelectedId(result.runId);
      setMessage("La collecte météo a démarré. Le suivi se met à jour automatiquement.");
      await loadRuns();
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED")router.replace("/admin/login");
      else setError(e instanceof Error?e.message:"Impossible de lancer la collecte.");
      await loadRuns();
    }finally{setStarting(false);}
  }

  return <main className="container-fluid px-3 px-lg-4 py-4">
    <div className="mb-4"><Link href="/admin" className="btn btn-outline-secondary">
      Retour à l’administration
    </Link></div>
    <header className="mb-4">
      <h1 className="h2 mb-1">Lancer le Parser Météo</h1>
      <p className="text-body-secondary mb-0">
        Actualisez les conditions météorologiques des villes actives depuis Open-Meteo.
        Cette collecte est manuelle ; aucune planification automatique n’est activée.
      </p>
    </header>
    {error&&<div className="alert alert-danger" role="alert">{error}</div>}
    {message&&<div className="alert alert-info" role="status">{message}</div>}
    <section className="card border-0 shadow-sm mb-4" aria-labelledby="weather-launch-heading">
      <div className="card-body p-4">
        <h2 id="weather-launch-heading" className="h5 mb-3">Critères de lancement</h2>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-7">
            <label htmlFor="weather-parser-continent" className="form-label">Continent</label>
            <select className="form-select" id="weather-parser-continent"
              disabled={loading||starting||Boolean(activeRun)}
              value={continent} onChange={e=>setContinent(e.target.value as WeatherContinent|"all")}>
              <option value="all">Tous les continents</option>
              {(Object.entries(WEATHER_CONTINENTS) as [WeatherContinent,string][])
                .map(([code,label])=><option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div className="col-12 col-lg-5 d-grid">
            <button type="button" className="btn btn-primary"
              disabled={loading||starting||Boolean(activeRun)||count===0}
              onClick={()=>void start()}>
              {starting?"Démarrage…":activeRun?"Collecte en cours…":"Lancer le Parser Météo"}
            </button>
          </div>
        </div>
        <p className="small text-body-secondary mt-3 mb-0" aria-live="polite">
          {loading?"Chargement des villes…":`${count} ville(s) active(s) concernée(s)
          sur ${cities.filter(city=>city.isActive).length} villes actives au total.`}
        </p>
        {count===0&&!loading&&<p className="small text-warning mt-2 mb-0">
          Aucune ville active dans cette sélection. Vérifiez la gestion des villes météo.
        </p>}
        <div className="mt-3">
          <Link href="/admin/weather-cities" className="link-primary small">Gérer les villes météo</Link>
        </div>
      </div>
    </section>
