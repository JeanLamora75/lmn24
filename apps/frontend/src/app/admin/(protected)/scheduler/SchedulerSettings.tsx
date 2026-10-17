"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Type = "INFOS" | "VIDEOS" | "WEATHER" | "HOROSCOPE_IMPORT";
type Config = {
  parserType: Type; isEnabled: boolean; intervalMinutes: number | null;
  localTime: string | null; timezone: string; nextDueAt: string | null;
  lastScheduledAt: string | null; updatedAt: string;
};
const names: Record<Type,string> = {
  INFOS:"Actualités RSS/XML", VIDEOS:"Vidéos YouTube",
  WEATHER:"Météo mondiale", HOROSCOPE_IMPORT:"Import Horoscope",
};
const order: Type[] = ["INFOS","VIDEOS","WEATHER","HOROSCOPE_IMPORT"];
export function SchedulerSettings() {
  const router = useRouter();
  const [rows,setRows] = useState<Config[]>([]);
  const [draft,setDraft] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState<Type|null>(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  async function load() {
    const res = await fetch("/api/admin/scheduler-settings",{cache:"no-store"});
    if (res.status===401) { router.replace("/admin/login"); return; }
    if(!res.ok) throw new Error("Impossible de récupérer la configuration du planificateur.");
    const body=await res.json() as {configured:Config[]};
    if(!Array.isArray(body.configured)) throw new Error("Configuration incorrecte.");
    setRows(body.configured);
    setDraft(Object.fromEntries(body.configured.map(x=>[
      x.parserType, x.parserType==="HOROSCOPE_IMPORT" ? x.localTime??"06:15" : String(x.intervalMinutes??60)
    ])));
  }
  useEffect(()=>{let live=true;void (async()=>{try{await load()}catch(e){if(live)setError(String(e))}finally{if(live)setLoading(false)}})();return()=>{live=false};},[]);
  async function save(row:Config) {
    setError("");setNotice("");
    const horoscope=row.parserType==="HOROSCOPE_IMPORT";
    const v=draft[row.parserType]??"";
    const num=Number(v);
    if(!horoscope && (!Number.isInteger(num)||num<15||num>1440)) {
      setError("Indiquez un intervalle entier de 15 à 1440 minutes.");return;
    }
    if(horoscope && (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)||v<"06:00")) {
      setError("L'import des horoscopes doit être prévu à partir de 06h00.");return;
    }
    setSaving(row.parserType);
    try {
      const res=await fetch("/api/admin/scheduler-settings",{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({parserType:row.parserType,isEnabled:false,
          intervalMinutes:horoscope?null:num,localTime:horoscope?v:null,
          expectedUpdatedAt:row.updatedAt})
      });
      if(res.status===401){router.replace("/admin/login");return}
      if(!res.ok){const b=await res.json().catch(()=>({})) as {message?:string};throw new Error(b.message||"Enregistrement impossible.")}
      await load();
      setNotice("Configuration enregistrée. L'automatisation reste désactivée.");
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setSaving(null)}
  }
  return <main className="container py-4 py-lg-5">
    <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
      <div><h1 className="h2 mb-1">Automatisation des parsers</h1>
      <p className="text-body-secondary mb-0">Préparer les horaires des moteurs de collecte existants.</p></div>
      <Link href="/admin" className="btn btn-outline-secondary">Retour administration</Link>
    </div>
    <div role="note" className="alert alert-warning"><strong>Planificateur non actif.</strong> Le lancement automatique sera disponible après la mise en place du verrou global et de l&apos;orchestrateur (SCRUM-84/85). Les boutons de lancement manuel restent inchangés.</div>
    {error&&<div role="alert" className="alert alert-danger">{error}</div>}
    {notice&&<div role="status" className="alert alert-success">{notice}</div>}
    {loading&&<p>Chargement des paramètres…</p>}
    <div className="row g-3">
    {order.map(type=>{
      const row=rows.find(x=>x.parserType===type);
      if(!row)return null;
      const daily=type==="HOROSCOPE_IMPORT";
      return <div className="col-12 col-lg-6" key={type}><section className="card h-100 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between gap-2">
            <h2 className="h5">{names[type]}</h2>
            <span className="badge text-bg-secondary">Désactivé</span>
          </div>
          <label htmlFor={"sched-"+type} className="form-label">{daily?"Heure quotidienne (Europe/Paris)":"Intervalle (minutes)"}</label>
          <input id={"sched-"+type} className="form-control" type={daily?"time":"number"}
            min={daily?"06:00":15} max={daily?undefined:1440} step={daily?undefined:15}
            value={draft[type]??""} disabled={saving!==null}
            onChange={e=>setDraft(old=>({...old,[type]:e.target.value}))}/>
          <p className="text-body-secondary small mt-2 mb-2">
            Prochaine exécution : non planifiée — activation suspendue.
          </p>
          <button className="btn btn-primary" type="button" disabled={saving!==null}
            onClick={()=>void save(row)}>{saving===type?"Enregistrement…":"Enregistrer les paramètres"}</button>
        </div>
      </section></div>
    })}
    </div>
    </main>;
}
