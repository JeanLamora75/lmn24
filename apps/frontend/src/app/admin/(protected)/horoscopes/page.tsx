"use client";
import { useCallback, useEffect, useState } from "react";
type FileInfo={fileName:string;date:string;count:number;expected:number;status:string;lastImportAt:string|null;error:string|null};
type Run={id:string;sourceFile:string;startedAt:string;status:string;itemsInserted:number;itemsSkipped:number;errorMessage:string|null};
const SIGNS=["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"];
const LABELS=["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
const LANGUAGES=["fr","en","de","es","it","pt","ru","nl"];
async function api<T>(endpoint:string,init?:RequestInit):Promise<T>{
  const r=await fetch("/api/admin/horoscopes/"+endpoint,{cache:"no-store",...init});
  const data:unknown=await r.json();if(!r.ok)throw new Error(typeof data==="object"&&data!==null&&"message" in data?String(data.message):"Opération impossible");
  return data as T;
}
export default function HoroscopesPage(){
  const [files,setFiles]=useState<FileInfo[]>([]);
  const [history,setHistory]=useState<Run[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [sign,setSign]=useState("aries");
  const [lang,setLang]=useState("fr");
  const [preview,setPreview]=useState<Record<string,string>|null>(null);
  const [selected,setSelected]=useState("");
  const refresh=useCallback(async()=>{const [f,h]=await Promise.all([api<FileInfo[]>("overview"),api<Run[]>("history")]);setFiles(f);setHistory(h);},[]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
  async function execute(fn:()=>Promise<unknown>){
    setBusy(true);setError("");setMessage("");
    try{await fn();setMessage("Opération terminée.");await refresh();}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function importFile(fileName:string){await execute(()=>api("files/"+encodeURIComponent(fileName)+"/import",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}));}
  async function importMissing(){
    await execute(async()=>{
      let successes=0;const failures:string[]=[];
      for(const file of files.filter(x=>x.count<96)){
        try{await api("files/"+encodeURIComponent(file.fileName)+"/import",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});successes++;}
        catch(e){failures.push(file.fileName+": "+String(e));}
      }
      if(failures.length)throw new Error(successes+" import(s) effectué(s). Échecs : "+failures.join("; "));
    });
  }
  async function upload(file:File){
    if(file.size>1_500_000){setError("Fichier trop volumineux (limite 1,5 Mo).");return;}
    await execute(async()=>{await api("upload",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fileName:file.name,content:await file.text()})});});
  }
  async function openPreview(fileName:string){
    setError("");setSelected(fileName);setPreview(null);
    try{setPreview(await api<Record<string,string>>("preview/"+fileName+"/"+sign+"/"+lang));}
    catch(e){setError(String(e));}
  }
  const imported=files.filter(x=>x.count===96).length;
  const partial=files.filter(x=>x.count>0&&x.count<96).length;
  return <main className="container py-4">
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div><h1 className="h3 mb-1">Gestion des horoscopes</h1><p className="text-body-secondary mb-0">Imports manuels et couverture des 12 signes dans 8 langues</p></div>
      <a className="btn btn-outline-secondary" href="/admin">Retour administration</a>
    </div>
    <div className="row g-3 mb-4">
      {[[ "Fichiers disponibles",files.length],["Importés",imported],["Partiels",partial],["À importer",files.length-imported-partial]].map(([name,count])=>
        <div className="col-6 col-xl-3" key={name}><div className="card h-100"><div className="card-body"><div className="small text-body-secondary">{name}</div><div className="fs-3 fw-bold">{count}</div></div></div></div>)}
    </div>
    {error&&<div className="alert alert-danger" role="alert">{error}</div>}
    {message&&<div className="alert alert-success" role="status">{message}</div>}
    <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
      <button className="btn btn-primary" disabled={busy||files.every(x=>x.count===96)} onClick={()=>void importMissing()}>Importer tous les fichiers manquants</button>
      <label className="btn btn-outline-primary mb-0">Importer un JSON depuis mon ordinateur
        <input type="file" accept=".json,application/json" className="visually-hidden" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.currentTarget.value="";}}/>
      </label>
      <button className="btn btn-outline-secondary" disabled={busy} onClick={()=>void execute(refresh)}>Actualiser</button>
    </div>
    <div className="card mb-4"><div className="card-header fw-semibold">Fichiers détectés</div>
      <div className="table-responsive"><table className="table table-hover align-middle mb-0">
      <thead><tr><th>Date</th><th>Fichier</th><th>Couverture</th><th>État</th><th>Actions</th></tr></thead>
      <tbody>{files.map(f=><tr key={f.fileName}>
        <td>{f.date}</td><td className="small">{f.fileName}</td><td>{f.count}/{f.expected}</td>
        <td><span className={"badge text-bg-"+(f.status==="IMPORTED"?"success":f.status==="ERROR"?"danger":f.status==="PARTIAL"?"warning":"secondary")}>{f.status}</span>{f.error&&<div className="small text-danger">{f.error}</div>}</td>
        <td><div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={()=>void openPreview(f.fileName)}>Prévisualiser</button>
          <button className="btn btn-sm btn-primary" disabled={busy||f.count===96} onClick={()=>void importFile(f.fileName)}>{f.count?"Compléter":"Importer"}</button>
        </div></td>
      </tr>)}
      {!files.length&&<tr><td colSpan={5} className="text-center py-4 text-body-secondary">Aucun fichier détecté dans le répertoire configuré.</td></tr>}
      </tbody></table></div></div>
    <div className="card mb-4"><div className="card-header fw-semibold">Prévisualisation</div><div className="card-body">
      <div className="d-flex flex-wrap gap-2 mb-3"><label>Signe <select className="form-select" value={sign} onChange={e=>setSign(e.target.value)}>{SIGNS.map((s,i)=><option key={s} value={s}>{LABELS[i]}</option>)}</select></label>
      <label>Langue <select className="form-select" value={lang} onChange={e=>setLang(e.target.value)}>{LANGUAGES.map(s=><option key={s}>{s}</option>)}</select></label>
      {selected&&<button className="btn btn-outline-primary align-self-end" onClick={()=>void openPreview(selected)}>Afficher</button>}</div>
      {!preview?<p className="text-body-secondary mb-0">Choisir un fichier puis « Prévisualiser ».</p>:<div>
        <h2 className="h5">{LABELS[SIGNS.indexOf(sign)]} — {preview.date} ({lang})</h2>
        {(["general","love","work","finance","disclaimer"] as const).map(key=><section key={key} className="mb-3"><h3 className="h6 text-capitalize">{key}</h3><p className="mb-0">{preview[key]}</p></section>)}
      </div>}
    </div></div>
    <div className="card"><div className="card-header fw-semibold">Historique des 100 dernières tentatives</div>
      <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Début</th><th>Fichier</th><th>Statut</th><th>Ajoutés</th><th>Ignorés</th><th>Erreur</th></tr></thead><tbody>
      {history.map(h=><tr key={h.id}><td>{new Date(h.startedAt).toLocaleString("fr-FR")}</td><td>{h.sourceFile}</td><td>{h.status}</td><td>{h.itemsInserted}</td><td>{h.itemsSkipped}</td><td>{h.errorMessage||"—"}</td></tr>)}
      {!history.length&&<tr><td colSpan={6} className="text-center py-3">Aucun import enregistré.</td></tr>}
      </tbody></table></div>
    </div>
  </main>;
}
