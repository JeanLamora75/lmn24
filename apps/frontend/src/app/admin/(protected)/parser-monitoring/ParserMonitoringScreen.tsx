"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Parser = "ALL" | "INFOS" | "VIDEOS";
type Period = "24h" | "7d" | "30d" | "custom";
type Status = "ALL" | "SUCCESS" | "ERROR" | "RUNNING" | "INTERRUPTED";
type PageData<T> = {
  rows: T[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
};
type RunRow = {
  id: string; batchRunId: string | null; parserType: string;
  feedId: string; source: string; feedUrl: string; status: string;
  startedAt: string; finishedAt: string | null; durationMs: number | null;
  itemsFound: number; imported: number; skipped: number; errorMessage: string | null;
};
type BatchRow = {
  id: string; parserType: string; trigger: string; startedAt: string;
  finishedAt: string | null; status: string; totalFeeds: number;
  processedFeeds: number; successfulFeeds: number; failedFeeds: number;
  itemsImported: number; itemsSkipped: number;
};
type EventRow = { id: string; timestamp: string; level: string;
  eventType: string; message: string };
type Summary = {
  periodFrom: string; periodTo: string;
  activeFeeds: { infos: number; videos: number; total: number };
  executions: number; completed: number; succeeded: number; failed: number;
  running: number; successRate: number | null; errorFeeds: number;
  importedInfos: number; importedVideos: number;
  averageDurationMs: number | null; lastStarted: string | null;
  panels: Array<{ type: string; runs: number; succeeded: number;
    errors: number; imported: number; lastRun: string | null }>;
  timeline: Array<{ bucket: string; parserType: string;
    status: string; total: number; imported: number }>;
};
type Alerts = { thresholds: { consecutiveFailures: number; stuckMinutes: number };
  rows: Array<{ type: string; parserType: string; feedId: string;
    source: string; feedUrl: string; message: string; at: string }> };
type Details = { kind: "run" | "batch"; data: RunRow | BatchRow };
const fmt = (n: number | null) => n === null ? "N/A" : n.toLocaleString("fr-FR");
const date = (s: string | null) => s
  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" })
    .format(new Date(s)) : "—";
const duration = (ms: number | null) => ms === null ? "—"
  : ms < 1000 ? ms + " ms" : (ms / 1000).toFixed(1) + " s";
const apiRoot = "/api/admin/parser-monitoring/";
async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiRoot + path, { cache: "no-store", ...(signal ? { signal } : {}) });
  if (!response.ok) {
    let message = "Erreur de consultation des parsers (" + response.status + ").";
    try { const body = await response.json() as { message?: string }; message = body.message || message; }
    catch { /* use the generic error */ }
    throw new Error(message);
  }
  return await response.json() as T;
}

function Kpi({ title, value, subtitle }: {
  title: string; value: string; subtitle: string;
}) {
  return <div className="col-6 col-lg-4 col-xxl-2">
    <div className="card h-100 shadow-sm"><div className="card-body p-3">
      <p className="text-body-secondary small mb-2">{title}</p>
      <strong className="h4 d-block">{value}</strong>
      <p className="small text-body-secondary mb-0">{subtitle}</p>
    </div></div>
  </div>;
}
function Chart({ rows, metric = "runs" }: { rows: Summary["timeline"]; metric?: "runs" | "imports" }) {
  const dates = [...new Set(rows.map(row => row.bucket))].sort();
  const byDate = dates.map(at => ({
    at,
    infosOk: rows.filter(r => r.bucket === at && r.parserType === "INFOS" &&
      r.status === "SUCCESS").reduce((n, r) => n + (metric === "imports" ? r.imported : r.total), 0),
    videosOk: rows.filter(r => r.bucket === at && r.parserType === "VIDEOS" &&
      r.status === "SUCCESS").reduce((n, r) => n + r.total, 0),
    errors: rows.filter(r => r.bucket === at &&
      ["ERROR","INTERRUPTED"].includes(r.status)).reduce((n,r) => n + (metric === "imports" ? r.imported : r.total), 0),
  }));
  const max = Math.max(1, ...byDate.map(x => x.infosOk + x.videosOk + x.errors));
  if (!dates.length) return <p className="text-body-secondary">
    Aucun historique disponible pour dessiner un graphique.</p>;
  return <>
    <div className="d-flex flex-wrap gap-3 small mb-2">
      <span><span className="text-primary">■</span> Infos réussies</span>
      <span><span className="text-success">■</span> Vidéos réussies</span>
      {metric === "runs" && <span><span className="text-danger">■</span> Erreurs</span>}
    </div>
    <svg viewBox="0 0 920 205" role="img" width="100%" height="205"
      aria-label={metric === "runs"
        ? "Histogramme des succès Infos, Vidéos et erreurs, par période UTC"
        : "Histogramme des articles et vidéos importés, par période UTC"}>
      {byDate.map((point, index) => {
        const w = 850 / byDate.length;
        const bw = Math.max(1, w * 0.72);
        const start = 50 + index * w + (w - bw) / 2;
        let top = 177;
        const layers = [
          { value: point.infosOk, fill: "#0d6efd" },
          { value: point.videosOk, fill: "#198754" },
          { value: point.errors, fill: "#dc3545" },
        ];
        return <g key={point.at}>
          {layers.filter((_item,i) => metric === "runs" || i < 2).map((item, i) => {
            const height = item.value / max * 155;
            top -= height;
            return <rect key={i} x={start} y={top} width={bw}
              height={height} fill={item.fill}><title>
                {point.at}: {item.value} {metric === "runs" ? "exécutions" : "contenus importés"}</title></rect>;
          })}
        </g>;
      })}
      <line x1="45" y1="177" x2="910" y2="177" stroke="currentColor"
        opacity=".4"/>
      <text x="45" y="196" fill="currentColor" fontSize="12">
        {dates[0]?.slice(5,16).replace("T"," ")} UTC
      </text>
      <text x="900" y="196" textAnchor="end" fill="currentColor" fontSize="12">
        {dates.at(-1)?.slice(5,16).replace("T"," ")} UTC
      </text>
    </svg>
    <details className="small"><summary>Valeurs détaillées accessibles</summary>
      <div className="table-responsive mt-2" style={{ maxHeight: 260 }}>
        <table className="table table-sm"><thead><tr>
          <th>Heure UTC</th><th>Infos {metric === "runs" ? "SUCCESS" : "importés"}</th><th>Vidéos {metric === "runs" ? "SUCCESS" : "importées"}</th>{metric === "runs" && <th>Erreurs</th>}
        </tr></thead><tbody>{byDate.map(p=><tr key={p.at}>
          <td>{p.at}</td><td>{p.infosOk}</td><td>{p.videosOk}</td>{metric === "runs" && <td>{p.errors}</td>}
        </tr>)}</tbody></table>
      </div>
    </details>
  </>;
}

export function ParserMonitoringScreen() {
  const [parser, setParser] = useState<Parser>("ALL");
  const [period, setPeriod] = useState<Period>("24h");
  const [status, setStatus] = useState<Status>("ALL");
  const [search, setSearch] = useState("");
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [language, setLanguage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [runs, setRuns] = useState<PageData<RunRow> | null>(null);
  const [batches, setBatches] = useState<PageData<BatchRow> | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [selected, setSelected] = useState<Details | null>(null);
  const [events, setEvents] = useState<PageData<EventRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const base = useMemo(() => {
    const params = new URLSearchParams({ parser, period, status,
      pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (countryId.trim()) params.set("countryId", countryId.trim());
    if (categoryId.trim()) params.set("categoryId", categoryId.trim());
    if (language.trim()) params.set("language", language.trim());
    if (period === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return params.toString();
  }, [parser, period, status, search, countryId, categoryId, language,
    pageSize, from, to]);

  const load = useCallback(async (signal: AbortSignal) => {
    if (period === "custom" && (!from || !to)) return;
    setLoading(true); setError("");
    try {
      const params = base;
      const [s, r, b, a] = await Promise.all([
        json<Summary>("summary?" + params, signal),
        json<PageData<RunRow>>("runs?" + params + "&page=" + page, signal),
        json<PageData<BatchRow>>("batches?" + params + "&page=" + batchPage, signal),
        json<Alerts>("alerts?" + params, signal),
      ]);
      if (signal.aborted) return;
      setSummary(s); setRuns(r); setBatches(b); setAlerts(a);
    } catch (e) {
      if (!signal.aborted) setError(e instanceof Error ? e.message : "Supervision indisponible.");
    } finally { if (!signal.aborted) setLoading(false); }
  }, [base, period, from, to, page, batchPage]);

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to avoid synchronous React effect state changes.
    const delay = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { controller.abort(); window.clearTimeout(delay); };
  }, [load, revision]);

  useEffect(() => {
    // Refresh only while the page is open and the browser tab is visible.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRevision(n => n + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected || selected.kind !== "batch") return;
    const controller = new AbortController();
    const id = selected.data.id;
    const timer = window.setTimeout(() => {
      void json<PageData<EventRow>>(
        "batches/" + id + "/events?page=" + eventPage +
        "&pageSize=20&errorsOnly=" + errorsOnly,
        controller.signal,
      ).then(setEvents).catch(e => {
        if (!controller.signal.aborted) setDetailError(
          e instanceof Error ? e.message : "Logs indisponibles.");
      });
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [selected, eventPage, errorsOnly]);

  function changeFilter<T>(setter: (value:T)=>void, value:T) {
    setter(value); setPage(1); setBatchPage(1);
  }
  function openRun(row: RunRow) {
    setSelected({ kind:"run",data:row }); setEvents(null); setDetailError("");
  }
  function openBatch(row: BatchRow) {
    setSelected({ kind:"batch",data:row }); setEvents(null);
    setEventPage(1); setErrorsOnly(false); setDetailError("");
  }
  const exportUrl = apiRoot + "export?" + base + "&page=1";

  return <main className="container-fluid px-3 px-lg-5 py-4">
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <h1 className="h2 mb-1">Logs et statistiques des parsers</h1>
        <p className="text-body-secondary mb-0">
          Collectes RSS/XML et YouTube — exécutions de flux et lancements globaux distincts.
        </p>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <Link href="/admin/parser" className="btn btn-outline-primary btn-sm">Parser Infos</Link>
        <Link href="/admin/video-parser" className="btn btn-outline-primary btn-sm">Parser Vidéos</Link>
        <Link href="/admin" className="btn btn-outline-secondary btn-sm">Retour admin</Link>
      </div>
    </div>
    <section className="card mb-4 shadow-sm" aria-label="Filtres de supervision">
      <div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-6 col-md-3 col-xl-2">
            <label htmlFor="monitor-parser" className="form-label">Parser</label>
            <select id="monitor-parser" className="form-select" value={parser}
              onChange={e=>changeFilter(setParser,e.target.value as Parser)}>
              <option value="ALL">Tous</option><option value="INFOS">Infos</option>
              <option value="VIDEOS">Vidéos</option>
            </select>
          </div>
          <div className="col-6 col-md-3 col-xl-2">
            <label htmlFor="monitor-period" className="form-label">Période</label>
            <select id="monitor-period" className="form-select" value={period}
              onChange={e=>changeFilter(setPeriod,e.target.value as Period)}>
              <option value="24h">24 heures</option><option value="7d">7 jours</option>
              <option value="30d">30 jours</option><option value="custom">Personnalisée</option>
            </select>
          </div>
          {period === "custom" && <>
            <div className="col-6 col-md-2">
              <label htmlFor="monitor-from" className="form-label">Du</label>
              <input id="monitor-from" type="date" value={from}
                className="form-control" onChange={e=>changeFilter(setFrom,e.target.value)}/>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="monitor-to" className="form-label">Au</label>
              <input id="monitor-to" type="date" value={to}
                className="form-control" onChange={e=>changeFilter(setTo,e.target.value)}/>
            </div>
          </>}
          <div className="col-6 col-md-3 col-xl-2">
            <label htmlFor="monitor-status" className="form-label">Statut</label>
            <select id="monitor-status" className="form-select" value={status}
              onChange={e=>changeFilter(setStatus,e.target.value as Status)}>
              {(["ALL","SUCCESS","ERROR","RUNNING","INTERRUPTED"] as const)
                .map(value=><option value={value} key={value}>
                  {value === "ALL" ? "Tous" : value}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <label htmlFor="monitor-search" className="form-label">Source ou URL du flux</label>
            <input id="monitor-search" className="form-control" maxLength={120}
              placeholder="Rechercher…" value={search}
              onChange={e=>changeFilter(setSearch,e.target.value)}/>
          </div>
          <div className="col-6 col-md-2">
            <label htmlFor="monitor-language" className="form-label">Langue (ISO 2)</label>
            <input id="monitor-language" className="form-control"
              maxLength={2} placeholder="Toutes" value={language}
              onChange={e=>changeFilter(setLanguage,e.target.value)}/>
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="monitor-country" className="form-label">Pays (UUID)</label>
            <input id="monitor-country" className="form-control"
              placeholder="Tous" value={countryId}
              onChange={e=>changeFilter(setCountryId,e.target.value)}/>
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="monitor-category" className="form-label">Catégorie (UUID)</label>
            <input id="monitor-category" className="form-control"
              placeholder="Toutes" value={categoryId}
              onChange={e=>changeFilter(setCategoryId,e.target.value)}/>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-primary"
              disabled={loading} onClick={()=>setRevision(n=>n+1)}>
              {loading?"Chargement…":"Actualiser"}
            </button>
          </div>
          <div className="col-auto">
            <a className="btn btn-outline-secondary" href={exportUrl}
              download="parser-runs.csv">Export CSV</a>
          </div>
        </div>
        <p className="small text-body-secondary mt-3 mb-0">
          Rafraîchissement toutes les 30 secondes si l’onglet est visible.
          Dates des filtres en UTC, heures du tableau affichées selon votre navigateur.
          Les stocks de flux actifs sont indépendants de la période et des filtres historiques.
        </p>
      </div>
    </section>
    {error && <div className="alert alert-danger" role="alert">
      {error} <button className="btn btn-sm btn-outline-danger ms-2"
        onClick={()=>setRevision(n=>n+1)}>Réessayer</button>
    </div>}
    {summary && <>
      <div className="row g-3 mb-4">
        <Kpi title="Flux actifs" value={fmt(summary.activeFeeds.total)}
          subtitle={summary.activeFeeds.infos+" Infos · "+summary.activeFeeds.videos+" Vidéos"}/>
        <Kpi title="Taux de réussite" value={summary.successRate===null
          ?"N/A":summary.successRate+" %"}
          subtitle={summary.completed+" exécutions terminées"}/>
        <Kpi title="Nouveaux contenus"
          value={fmt(summary.importedInfos+summary.importedVideos)}
          subtitle={summary.importedInfos+" articles · "+summary.importedVideos+" vidéos"}/>
        <Kpi title="Flux en erreur" value={fmt(summary.errorFeeds)}
          subtitle="Flux distincts avec ERROR sur la période"/>
        <Kpi title="Durée moyenne" value={duration(summary.averageDurationMs)}
          subtitle="Exécutions terminées, durées connues"/>
        <Kpi title="Dernière collecte" value={date(summary.lastStarted)}
          subtitle="Dernière exécution de flux connue"/>
      </div>
      <div className="row g-3 mb-4">
        {summary.panels.map(panel=><div className="col-12 col-lg-6" key={panel.type}>
          <section className="card h-100 shadow-sm"><div className="card-body">
            <h2 className="h5">Parser {panel.type==="INFOS"?"Infos":"Vidéos"}</h2>
            <p className="text-body-secondary small mb-2">
              Dernière collecte : {date(panel.lastRun)}
            </p>
            <div className="d-flex flex-wrap gap-3">
              <span><strong>{fmt(panel.runs)}</strong> traitements</span>
              <span className="text-success"><strong>{fmt(panel.succeeded)}</strong> réussis</span>
              <span className="text-danger"><strong>{fmt(panel.errors)}</strong> erreurs</span>
              <span><strong>{fmt(panel.imported)}</strong> importés</span>
            </div>
          </div></section>
        </div>)}
      </div>
      <section className="card shadow-sm mb-4"><div className="card-body">
        <h2 className="h5">Évolution des exécutions</h2>
        <Chart rows={summary.timeline}/>
        <h3 className="h6 mt-4">Articles et vidéos importés par période</h3>
        <Chart rows={summary.timeline} metric="imports"/>
        <p className="small text-body-secondary mb-0">
          Buckets UTC ; les succès Infos et Vidéos sont présentés séparément.
        </p>
      </div></section>
    </>}
    <section className="card shadow-sm mb-4"><div className="card-body">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
        <h2 className="h5 mb-0">Historique des exécutions par flux</h2>
        <label>Résultats / page{" "}
          <select className="form-select form-select-sm d-inline-block w-auto"
            value={pageSize} onChange={e=>changeFilter(setPageSize,Number(e.target.value))}>
            <option>20</option><option>50</option><option>100</option>
          </select>
        </label>
      </div>
      {!runs?.rows.length ? <p className="text-body-secondary">
        Aucun historique de flux pour la sélection.
      </p> : <div className="table-responsive">
        <table className="table table-hover table-sm align-middle">
          <thead><tr><th>Date</th><th>Parser</th><th>Source / flux</th>
            <th>Statut</th><th>Durée</th><th>Détectés</th><th>Importés</th>
            <th>Ignorés</th><th>Action</th></tr></thead>
          <tbody>{runs.rows.map(row=><tr key={row.parserType+row.id}>
            <td className="text-nowrap">{date(row.startedAt)}</td>
            <td>{row.parserType==="INFOS"?"Infos":"Vidéos"}</td>
            <td style={{maxWidth:230,overflowWrap:"anywhere"}}>
              <strong>{row.source}</strong><div className="small text-body-secondary">
                {row.feedUrl}</div>
            </td>
            <td><span className={"badge "+(row.status==="SUCCESS"
              ?"text-bg-success":row.status==="ERROR"?"text-bg-danger"
                :"text-bg-secondary")}>{row.status}</span></td>
            <td>{duration(row.durationMs)}</td><td>{fmt(row.itemsFound)}</td>
            <td>{fmt(row.imported)}</td><td>{fmt(row.skipped)}</td>
            <td><button type="button" className="btn btn-outline-primary btn-sm"
              onClick={()=>openRun(row)}>Détails</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
        <small>{fmt(runs?.pagination.total??0)} exécutions de flux</small>
        <div className="btn-group">
          <button className="btn btn-outline-secondary btn-sm" disabled={page<=1}
            onClick={()=>setPage(v=>v-1)}>Précédent</button>
          <span className="btn btn-outline-secondary btn-sm disabled">
            {page} / {Math.max(1,runs?.pagination.totalPages??1)}</span>
          <button className="btn btn-outline-secondary btn-sm"
            disabled={page>=(runs?.pagination.totalPages??1)}
            onClick={()=>setPage(v=>v+1)}>Suivant</button>
        </div>
      </div>
    </div></section>
    <section className="card shadow-sm mb-4"><div className="card-body">
      <h2 className="h5">Lancements globaux des parsers</h2>
      <p className="text-body-secondary small">
        L’historique global commence à l’installation de SCRUM-60 ;
        les exécutions plus anciennes restent dans le tableau ci-dessus.
      </p>
      {!batches?.rows.length?<p>Aucun lancement global historisé.</p>
      :<div className="table-responsive"><table className="table table-sm table-hover">
        <thead><tr><th>Début</th><th>Parser</th><th>Origine</th>
          <th>Statut</th><th>Traités</th><th>Réussis</th><th>Échecs</th>
          <th>Importés</th><th>Actions</th></tr></thead>
        <tbody>{batches.rows.map(row=><tr key={row.id}>
          <td>{date(row.startedAt)}</td><td>{row.parserType}</td><td>{row.trigger}</td>
          <td>{row.status}</td><td>{fmt(row.processedFeeds)}/{fmt(row.totalFeeds)}</td>
          <td>{fmt(row.successfulFeeds)}</td><td>{fmt(row.failedFeeds)}</td>
          <td>{fmt(row.itemsImported)}</td>
          <td><button className="btn btn-sm btn-outline-primary" type="button"
            onClick={()=>openBatch(row)}>Journal</button></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="d-flex gap-2 justify-content-end">
        <button type="button" className="btn btn-sm btn-outline-secondary"
          disabled={batchPage<=1} onClick={()=>setBatchPage(n=>n-1)}>Précédent</button>
        <span className="small align-self-center">
          {batchPage}/{Math.max(1,batches?.pagination.totalPages??1)}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary"
          disabled={batchPage>=(batches?.pagination.totalPages??1)}
          onClick={()=>setBatchPage(n=>n+1)}>Suivant</button>
      </div>
    </div></section>
    <section className="card shadow-sm mb-4"><div className="card-body">
      <h2 className="h5">Alertes et anomalies</h2>
      <p className="text-body-secondary small">
        {alerts?"Seuils : "+alerts.thresholds.consecutiveFailures+
          " échecs consécutifs ou RUNNING depuis "+
          alerts.thresholds.stuckMinutes+" minutes.":"Calcul des alertes…"}
        {" "}Un faible volume de publications n’est pas considéré comme une panne.
      </p>
      {!alerts?.rows.length?<p className="text-body-secondary">
        Aucune anomalie détectée pour la période.</p>
      :<div className="list-group">{alerts.rows.map((row,i)=>
        <div key={row.parserType+row.feedId+row.type+i}
          className="list-group-item">
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <strong>{row.source} — {row.parserType}</strong>
            <small>{date(row.at)}</small>
          </div><p className="text-danger mb-1">{row.message}</p>
          <small className="text-break">{row.feedUrl}</small>
        </div>)}</div>}
    </div></section>
    {selected && <section className="card border-primary shadow-sm mb-4"
      aria-label="Détails d'exécution" role="region">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center gap-2">
          <h2 className="h5 mb-2">
            {selected.kind==="batch"?"Journal d'un lancement global":"Détails de l'exécution du flux"}
          </h2>
          <button type="button" className="btn-close" aria-label="Fermer les détails"
            onClick={()=>{setSelected(null);setEvents(null);}}/>
        </div>
        <dl className="row small">
          <dt className="col-sm-3">Identifiant</dt><dd className="col-sm-9 text-break">
            <code>{selected.data.id}</code></dd>
          <dt className="col-sm-3">Début</dt><dd className="col-sm-9">
            {date(selected.data.startedAt)}</dd>
          <dt className="col-sm-3">Fin</dt><dd className="col-sm-9">
            {date(selected.data.finishedAt)}</dd>
          <dt className="col-sm-3">Statut</dt><dd className="col-sm-9">
            {selected.data.status}</dd>
        </dl>
        {selected.kind==="run" && <>
          <p><strong>Flux :</strong> <span className="text-break">
            {(selected.data as RunRow).feedUrl}</span></p>
          <p><strong>Détectés :</strong> {fmt((selected.data as RunRow).itemsFound)} ;
            <strong> importés :</strong> {fmt((selected.data as RunRow).imported)} ;
            <strong> ignorés :</strong> {fmt((selected.data as RunRow).skipped)}</p>
          {(selected.data as RunRow).errorMessage && <pre className="alert alert-danger text-wrap"
            style={{overflowWrap:"anywhere"}}>{(selected.data as RunRow).errorMessage}</pre>}
          {(selected.data as RunRow).batchRunId && <p className="small">
            Lancement associé : <code>{(selected.data as RunRow).batchRunId}</code>
          </p>}
        </>}
        {selected.kind==="batch" && <>
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <p className="small mb-0">Événements conservés en PostgreSQL</p>
            <label className="small">
              <input type="checkbox" className="form-check-input me-2"
                checked={errorsOnly} onChange={e=>{
                  setErrorsOnly(e.target.checked);setEventPage(1);}}/>
              Erreurs uniquement
            </label>
          </div>
          {detailError&&<p className="alert alert-danger">{detailError}</p>}
          {!events?.rows.length?<p>Aucun événement pour cette sélection.</p>
            :<div className="table-responsive"><table className="table table-sm">
              <thead><tr><th>Horodatage</th><th>Niveau</th><th>Événement</th>
                <th>Message</th></tr></thead><tbody>{events.rows.map(item=>
                <tr key={item.id}><td className="text-nowrap">{date(item.timestamp)}</td>
                  <td>{item.level}</td><td>{item.eventType}</td>
                  <td style={{overflowWrap:"anywhere"}}>{item.message}</td></tr>)}
              </tbody></table></div>}
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-sm btn-outline-secondary"
              disabled={eventPage<=1} onClick={()=>setEventPage(n=>n-1)}>Précédent</button>
            <span className="small align-self-center">{eventPage} /
              {Math.max(1,events?.pagination.totalPages??1)}</span>
            <button className="btn btn-sm btn-outline-secondary"
              disabled={eventPage>=(events?.pagination.totalPages??1)}
              onClick={()=>setEventPage(n=>n+1)}>Suivant</button>
          </div>
        </>}
      </div>
    </section>}
  </main>;
}
