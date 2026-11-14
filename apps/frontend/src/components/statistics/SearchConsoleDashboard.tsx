"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminIcon } from "@/components/admin/AdminIcon";

type Row = {page:string;clicks:number;impressions:number;ctr:number;position:number};
type Sitemap = {path:string;lastSubmitted:string|null;lastDownloaded:string|null;isPending:boolean;
  errors:number;warnings:number;submitted:number|null;indexed:number|null};
type Report = {configured:boolean;property:string;period:7|30;rows:Row[];
  totalClicks:number;totalImpressions:number;averageCtr:number;averagePosition:number|null;
  sitemap:Sitemap|null;sitemapStatus:"found"|"missing"|"unavailable"};
const number = (value:number) => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(value);
const date = (value:string|null) => {
  if (!value) return "Non disponible";
  const parsed=new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Non disponible" : parsed.toLocaleDateString("fr-FR");
};

export function SearchConsoleDashboard() {
  const [period,setPeriod]=useState<"7d"|"30d">("30d");
  const [refresh,setRefresh]=useState(0);
  const [data,setData]=useState<Report|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const abort=new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/admin/statistics/search-console?period="+period,{
      cache:"no-store",signal:abort.signal,
    }).then(async response=>{
      const value=await response.json() as Report & {message?:string};
      if(!response.ok) throw new Error(value.message || "Impossible de lire Google Search Console.");
      return value;
    }).then(value=>{if(!abort.signal.aborted) setData(value);})
      .catch(reason=>{if(!abort.signal.aborted){setData(null);
        setError(reason instanceof Error?reason.message:"Données indisponibles.");}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[period,refresh]);
  return <main className="container-fluid px-3 px-lg-4 py-4">
    <header className="mb-4">
      <Link href="/admin" className="btn btn-sm btn-outline-secondary mb-3">
        <AdminIcon name="arrow-left" className="me-2"/> Administration
      </Link>
      <h1 className="h2">Google Search Console</h1>
      <p className="text-body-secondary">Performances de recherche et état du sitemap de LMN24. Ce rapport est distinct de Google Analytics.</p>
    </header>
    <nav className="d-flex gap-2 flex-wrap mb-4" aria-label="Sources de statistiques">
      <Link href="/admin/site-statistics" className="btn btn-outline-secondary">Statistiques LMN24</Link>
      <Link href="/admin/site-statistics/google-analytics" className="btn btn-outline-secondary">Google Analytics</Link>
      <span className="btn btn-primary" aria-current="page">Search Console</span>
    </nav>
    <div className="d-flex align-items-center gap-2 mb-4">
      <label htmlFor="gsc-period" className="mb-0">Période</label>
      <select id="gsc-period" className="form-select w-auto" value={period}
        onChange={e=>setPeriod(e.target.value==="7d"?"7d":"30d")}>
        <option value="7d">7 jours</option><option value="30d">30 jours</option>
      </select>
      <button type="button" className="btn btn-outline-secondary" disabled={loading}
        onClick={()=>setRefresh(x=>x+1)}>
        <AdminIcon name="arrow-clockwise" className="me-2"/>Actualiser
      </button>
    </div>
    {loading?<p role="status">Lecture des données Search Console…</p>:null}
    {error?<div className="alert alert-warning" role="alert">{error}
      <p className="mb-0 mt-2">L'accès à Search Console doit être autorisé explicitement pour la propriété concernée.</p>
    </div>:null}
    {data?<div>
      <p className="text-body-secondary small">Propriété : <code>{data.property}</code>. Données finales jusqu'à trois jours avant aujourd'hui, susceptibles d'être différées. Une absence de données ne signifie pas absence d'indexation.</p>
      <div className="row g-3 mb-4">
        {[
          ["Clics depuis Google",number(data.totalClicks)],
          ["Impressions",number(data.totalImpressions)],
          ["CTR moyen",(data.averageCtr*100).toFixed(1)+" %"],
          ["Position moyenne",data.averagePosition===null?"—":number(data.averagePosition)],
        ].map(([label,value])=><div className="col-6 col-xl-3" key={label}>
          <div className="card h-100 shadow-sm"><div className="card-body">
            <p className="text-body-secondary small mb-1">{label}</p>
            <strong className="fs-4">{value}</strong>
          </div></div>
        </div>)}
      </div>
      <div className="card shadow-sm mb-4"><div className="card-body">
        <h2 className="h5">Sitemap</h2>
        {data.sitemapStatus==="unavailable"?<p className="text-warning">État du sitemap indisponible dans l'API.</p>:
        data.sitemapStatus==="missing"?<p className="text-warning">Aucun sitemap LMN24 soumis ou retrouvé sur cette propriété. Soumettre le sitemap depuis Google Search Console.</p>:
        data.sitemap?<dl className="row mb-0">
          <dt className="col-sm-4">URL</dt><dd className="col-sm-8"><code>{data.sitemap.path}</code></dd>
          <dt className="col-sm-4">Dernière soumission</dt><dd className="col-sm-8">{date(data.sitemap.lastSubmitted)}</dd>
          <dt className="col-sm-4">Dernière consultation</dt><dd className="col-sm-8">{date(data.sitemap.lastDownloaded)}</dd>
          <dt className="col-sm-4">En cours de traitement</dt><dd className="col-sm-8">{data.sitemap.isPending?"Oui":"Non"}</dd>
          <dt className="col-sm-4">Erreurs / avertissements</dt><dd className="col-sm-8">{data.sitemap.errors} / {data.sitemap.warnings}</dd>
          <dt className="col-sm-4">URL soumises / indexées</dt><dd className="col-sm-8">{data.sitemap.submitted??"Non disponible"} / {data.sitemap.indexed??"Non disponible"}</dd>
        </dl>:null}
        <p className="small text-body-secondary mt-3 mb-0">Une soumission ne garantit pas l'indexation. Les chiffres de sitemap peuvent être incomplets ou différés.</p>
      </div></div>
      <div className="card shadow-sm"><div className="card-body">
        <h2 className="h5">Pages recevant des impressions</h2>
        {data.rows.length===0?<p>Aucune page dans les données disponibles pour cette période.</p>:
        <div className="table-responsive"><table className="table table-striped align-middle">
          <thead><tr><th>Page</th><th className="text-end">Clics</th><th className="text-end">Impressions</th><th className="text-end">CTR</th><th className="text-end">Position</th></tr></thead>
          <tbody>{data.rows.map(row=><tr key={row.page}>
            <td className="text-break"><a href={row.page} target="_blank" rel="noopener noreferrer">{row.page}</a></td>
            <td className="text-end">{number(row.clicks)}</td>
            <td className="text-end">{number(row.impressions)}</td>
            <td className="text-end">{(row.ctr*100).toFixed(1)} %</td>
            <td className="text-end">{number(row.position)}</td>
          </tr>)}</tbody>
        </table></div>}
        <p className="small text-body-secondary">Les 100 premières pages affichées ne constituent pas l'intégralité des pages indexées.</p>
      </div></div>
    </div>:null}
  </main>;
}
