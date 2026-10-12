"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/home/CountryFlag";
import { countryName } from "@/components/home/country-flag";

type Item = { name: string; count: number; id?: string };
type Dashboard = {
  generatedAt: string;
  overview: { sources: number; activeSources: number; feeds: number; activeFeeds: number;
    articles: number; periodArticles: number; countries: number; categories: number; languages: number };
  editorial: { periodArticles: number; dailyAverage: number; byDay: { key?: string; name: string; count: number }[];
    byHour: { hour: string; count: number }[]; topSources: Item[] };
  distribution: { byCountry: Item[]; byCategory: Item[]; byLanguage: Item[];
    matrix: { country: string; categories: Item[] }[] };
  health: { operational: number; failing: number; monitoring: number; totalRuns: number;
    successRate: number | null; averageDurationMs: number | null; found: number;
    imported: number; skipped: number; stale24h: number; stale7d: number; stale30d: number;
    errors: { key: string; count: number }[]; anomalies: { id: string; name: string; status: string | null; message: string | null }[] };
  quality: { metrics: { key: string; label: string; count: number; rate: number | null }[];
    globalScore: number | null; leastComplete: { id: string; name: string; score: number }[] };
  actions: { withoutFeeds: number; withoutArticles: number; withoutImage: number;
    incomplete: number; failedFeeds: number; staleFeeds: number };
  filters: { countries: { id: string; isoCode2: string }[];
    categories: { id: string; slug: string }[];
    languages: { isoCode2: string }[]; sources: { id: string; name: string }[] };
};

const languageNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["fr"], { type: "language" }) : null;
const languageFlags: Record<string, string> = {
  fr: "FR", en: "GB", de: "DE", es: "ES", it: "IT", pt: "PT", nl: "NL",
  ar: "SA", zh: "CN", ja: "JP", ko: "KR", ru: "RU", uk: "UA", pl: "PL",
  tr: "TR", sv: "SE", da: "DK", no: "NO", fi: "FI", el: "GR", cs: "CZ",
  ro: "RO", hu: "HU", hi: "IN", he: "IL",
};
function languageName(code: string): string {
  try { return languageNames?.of(code.trim().toLowerCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}
function FlaggedName({ code, kind }: { code: string; kind: "country" | "language" }) {
  const iso = code.trim().toUpperCase();
  const flagCode = kind === "country" ? iso : languageFlags[iso.toLowerCase()];
  const name = kind === "country" ? countryName(iso, "fr") : languageName(iso);
  return <span className="d-inline-flex align-items-center gap-2" style={{ minWidth: 0 }}>
    {flagCode ? <CountryFlag countryIsoCode2={flagCode} locale="fr" /> : null}
    <span>{name}</span>
  </span>;
}
const number = (value: number) => new Intl.NumberFormat("fr-FR").format(value);
const percentage = (value: number | null) => value === null ? "N/A" : value + " %";

function Histogram({ items, maxItems = 10, kind }: { items: Item[]; maxItems?: number; kind?: "country" | "language" }) {
  const top = items.slice(0, maxItems);
  const maximum = Math.max(1, ...top.map((x) => x.count));
  if (!top.length) return <p className="text-body-secondary">Aucune donnée sur cette période.</p>;
  return <div className="d-grid gap-2" style={{ minWidth: 0 }}>{top.map((item) => <div key={item.name} style={{ minWidth: 0 }}>
    <div className="d-flex justify-content-between align-items-start small gap-2" style={{ minWidth: 0 }}><span className="text-break" style={{ minWidth: 0, overflowWrap: "anywhere", flex: "1 1 0" }}>{kind ? <FlaggedName code={item.name} kind={kind} /> : item.name}</span><strong className="flex-shrink-0">{number(item.count)}</strong></div>
    <div className="progress" style={{ height: 9 }} role="progressbar" aria-label={item.name}
      aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={item.count}>
      <div className="progress-bar" style={{ width: (item.count / maximum * 100) + "%" }} />
    </div>
  </div>)}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card shadow-sm h-100" style={{ minWidth: 0 }}><div className="card-body p-4" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <h2 className="h5 mb-4">{title}</h2>{children}
  </div></section>;
}

function Kpi({ name, value, sub, href }: { name: string; value: string; sub?: string; href?: string }) {
  const body = <div className="card h-100 shadow-sm"><div className="card-body">
    <p className="small text-body-secondary mb-2">{name}</p><strong className="fs-2">{value}</strong>
    {sub ? <div className="small text-body-secondary mt-1">{sub}</div> : null}
  </div></div>;
  return <div className="col-6 col-lg-4 col-xl-2">{href ? <Link className="text-decoration-none text-body" href={href}>{body}</Link> : body}</div>;
}

export function StatisticsDashboard() {
  const [period, setPeriod] = useState("7d");
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [language, setLanguage] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    if (period === "custom" && (!from || !to || from > to)) return;
    const abort = new AbortController();
    const params = new URLSearchParams({ period });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    if (countryId) params.set("countryId", countryId);
    if (categoryId) params.set("categoryId", categoryId);
    if (language) params.set("language", language);
    if (sourceId) params.set("sourceId", sourceId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/admin/statistics?" + params.toString(), { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Statistiques indisponibles (" + response.status + ").");
        return (await response.json()) as Dashboard;
      })
      .then((value) => { if (!abort.signal.aborted) setData(value); })
      .catch((reason: unknown) => {
        if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Chargement impossible.");
      })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [period, from, to, countryId, categoryId, language, sourceId, revision]);

  const filters = data?.filters;
  const o = data?.overview;
  const h = data?.health;
  return <main className="container-fluid px-3 px-lg-4 py-4">
    <header className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
      <div><Link href="/admin" className="btn btn-outline-secondary btn-sm mb-3">← Administration</Link>
        <h1 className="h2 mb-1">Statistiques LMN24</h1>
        <p className="text-body-secondary mb-0">Pilotage éditorial, qualité et supervision des collectes.</p></div>
      <div className="text-end"><button type="button" className="btn btn-primary" onClick={refresh} disabled={loading}>Actualiser</button>
        <div className="small text-body-secondary mt-2">Actualisé : {data ? new Date(data.generatedAt).toLocaleString("fr-FR") : "—"}</div></div>
    </header>
    <div className="card mb-4"><div className="card-body"><div className="row g-2">
      <div className="col-6 col-md-2"><label className="form-label" htmlFor="stats-period">Période</label><select id="stats-period" className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="24h">24 h</option><option value="7d">7 jours</option><option value="30d">30 jours</option><option value="90d">90 jours</option><option value="custom">Personnalisée</option>
      </select></div>
      {period === "custom" ? <><div className="col-6 col-md-2"><label htmlFor="stats-from" className="form-label">Du</label><input id="stats-from" type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="col-6 col-md-2"><label htmlFor="stats-to" className="form-label">Au</label><input id="stats-to" type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div></> : null}
      <div className="col-6 col-md-2"><label htmlFor="stats-country" className="form-label">Pays</label><select id="stats-country" className="form-select" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
        <option value="">Tous</option>{[...(filters?.countries ?? [])].sort((a, b) => countryName(a.isoCode2, "fr").localeCompare(countryName(b.isoCode2, "fr"), "fr", { sensitivity: "base" })).map((x) => <option key={x.id} value={x.id}>{countryName(x.isoCode2, "fr")} ({x.isoCode2.trim().toUpperCase()})</option>)}</select></div>
      <div className="col-6 col-md-2"><label htmlFor="stats-category" className="form-label">Catégorie</label><select id="stats-category" className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Toutes</option>{filters?.categories.map((x) => <option key={x.id} value={x.id}>{x.slug}</option>)}</select></div>
      <div className="col-6 col-md-2"><label htmlFor="stats-language" className="form-label">Langue</label><select id="stats-language" className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="">Toutes</option>{[...(filters?.languages ?? [])].sort((a, b) => languageName(a.isoCode2).localeCompare(languageName(b.isoCode2), "fr")).map((x) => <option key={x.isoCode2} value={x.isoCode2.trim()}>{languageFlags[x.isoCode2.trim().toLowerCase()] ? String.fromCodePoint(...[...languageFlags[x.isoCode2.trim().toLowerCase()]].map((letter) => letter.charCodeAt(0) + 127397)) + " " : ""}{languageName(x.isoCode2)} ({x.isoCode2.trim().toUpperCase()})</option>)}</select></div>
      <div className="col-6 col-md-2"><label htmlFor="stats-source" className="form-label">Source</label><select id="stats-source" className="form-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">Toutes</option>{filters?.sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
    </div></div></div>
    {error ? <div className="alert alert-danger" role="alert">{error} <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={refresh}>Réessayer</button></div> : null}
    {loading ? <div className="alert alert-info" role="status">Actualisation des statistiques…</div> : null}
    {!data ? null : <>
      <h2 className="h4 mb-3">Vue d’ensemble</h2>
      <div className="row g-3 mb-4">
        <Kpi name="Sources" value={number(o!.sources)} sub={number(o!.activeSources) + " actives"} href="/admin/sources" />
        <Kpi name="Flux RSS/XML" value={number(o!.feeds)} sub={number(o!.activeFeeds) + " actifs"} href="/admin/feeds" />
        <Kpi name="Articles" value={number(o!.articles)} sub={number(o!.periodArticles) + " sur la période"} />
        <Kpi name="Pays" value={number(o!.countries)} /><Kpi name="Catégories" value={number(o!.categories)} href="/admin/categories" />
        <Kpi name="Langues" value={number(o!.languages)} />
      </div>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-7"><Panel title="Activité éditoriale — articles collectés">
          <div className="d-flex gap-4 mb-3"><div><div className="small text-body-secondary">Articles</div><strong className="fs-3">{number(data.editorial.periodArticles)}</strong></div>
            <div><div className="small text-body-secondary">Moyenne / jour</div><strong className="fs-3">{number(data.editorial.dailyAverage)}</strong></div></div>
          <Histogram items={data.editorial.byDay.map((x) => ({ name: x.name, count: x.count }))} maxItems={100} />
          <h3 className="h6 mt-4">Répartition par heure (UTC)</h3><Histogram items={data.editorial.byHour.map((x) => ({ name: x.hour, count: x.count }))} maxItems={24} />
        </Panel></div>
        <div className="col-12 col-lg-5"><Panel title="Top 10 des sources productives"><Histogram items={data.editorial.topSources}/></Panel></div>
      </div>
      <h2 className="h4 mb-3">Couverture géographique et thématique</h2>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-4"><Panel title="Articles par pays"><Histogram kind="country" items={data.distribution.byCountry}/></Panel></div>
        <div className="col-12 col-lg-4"><Panel title="Articles par catégorie"><Histogram items={data.distribution.byCategory}/></Panel></div>
        <div className="col-12 col-lg-4"><Panel title="Articles par langue"><Histogram kind="language" items={data.distribution.byLanguage}/></Panel></div>
        <div className="col-12"><Panel title="Matrice Pays × Catégories">
          {data.distribution.matrix.length ? <div className="table-responsive"><table className="table table-striped table-sm">
            <thead><tr><th>Pays</th>{data.distribution.matrix[0]?.categories.map((x) => <th key={x.name} className="text-end">{x.name}</th>)}</tr></thead>
            <tbody>{data.distribution.matrix.map((row) => <tr key={row.country}><th><FlaggedName code={row.country} kind="country" /></th>{row.categories.map((x) => <td key={x.name} className="text-end">{number(x.count)}</td>)}</tr>)}</tbody>
          </table></div> : <p className="text-body-secondary">Aucune donnée sur la période.</p>}
        </Panel></div>
      </div>
      <h2 className="h4 mb-3">Santé des flux et du parser</h2>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6"><Panel title="Supervision des flux actifs">
          <div className="row g-2 text-center mb-4"><div className="col-4"><strong className="fs-3 text-success">{h!.operational}</strong><div className="small">Opérationnels</div></div>
            <div className="col-4"><strong className="fs-3 text-warning">{h!.monitoring}</strong><div className="small">À surveiller</div></div>
            <div className="col-4"><strong className="fs-3 text-danger">{h!.failing}</strong><div className="small">En échec</div></div></div>
          <div className="row g-3 small">
            <div className="col-6">Collectes : <strong>{number(h!.totalRuns)}</strong></div>
            <div className="col-6">Réussite : <strong>{percentage(h!.successRate)}</strong></div>
            <div className="col-6">Durée moyenne : <strong>{h!.averageDurationMs === null ? "N/A" : h!.averageDurationMs + " ms"}</strong></div>
            <div className="col-6">Détectés : <strong>{number(h!.found)}</strong></div>
            <div className="col-6">Importés : <strong>{number(h!.imported)}</strong></div>
            <div className="col-6">Ignorés : <strong>{number(h!.skipped)}</strong></div>
            <div className="col-6">Non relevés depuis 24 h : <strong>{h!.stale24h}</strong></div>
            <div className="col-6">7 j : <strong>{h!.stale7d}</strong> · 30 j : <strong>{h!.stale30d}</strong></div>
          </div>
        </Panel></div>
        <div className="col-12 col-lg-6"><Panel title="Erreurs les plus fréquentes"><Histogram items={h!.errors.map((x) => ({name:x.key,count:x.count}))}/></Panel></div>
        <div className="col-12"><Panel title="Flux présentant des anomalies">
          {h!.anomalies.length ? <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Source</th><th>État</th><th>Message</th><th></th></tr></thead>
            <tbody>{h!.anomalies.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.status}</td><td className="text-break">{x.message || "N/A"}</td>
              <td><Link href={"/admin/feeds/" + x.id + "/edit"}>Diagnostiquer</Link></td></tr>)}</tbody></table></div>
            : <p className="text-body-secondary">Aucune anomalie détectée parmi les flux actifs.</p>}
        </Panel></div>
      </div>
      <h2 className="h4 mb-3">Qualité des fiches sources</h2>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-7"><Panel title={"Complétude globale : " + percentage(data.quality.globalScore)}>
          {data.quality.metrics.map((x) => <div key={x.key} className="mb-3">
            <div className="d-flex justify-content-between small"><span>{x.label}</span><span>{number(x.count)} / {number(o!.sources)} ({percentage(x.rate)})</span></div>
            <div className="progress" style={{height:10}}><div className="progress-bar bg-success" style={{width:(x.rate??0)+"%"}} /></div>
          </div>)}
        </Panel></div>
        <div className="col-12 col-lg-5"><Panel title="Fiches les moins complètes">
          {data.quality.leastComplete.length ? <div className="list-group list-group-flush">{data.quality.leastComplete.map((x) =>
            <Link key={x.id} className="list-group-item list-group-item-action d-flex justify-content-between gap-2" href={"/admin/sources/"+x.id+"/edit"}><span>{x.name}</span><strong>{x.score}%</strong></Link>)}</div>
            : <p className="text-body-secondary">Aucune source.</p>}
        </Panel></div>
      </div>
      <h2 className="h4 mb-3">Actions prioritaires</h2>
      <div className="row g-3 mb-4">{[
        ["Sources sans flux",data.actions.withoutFeeds,"/admin/sources?feedRange=0"],
        ["Sources sans article",data.actions.withoutArticles,"/admin/sources?articleRange=0"],
        ["Flux en échec",data.actions.failedFeeds,"/admin/feeds"],
        ["Sources sans image",data.actions.withoutImage,"/admin/sources"],
        ["Flux sans relevé récent (7 j)",data.actions.staleFeeds,"/admin/feeds"],
      ].map(([title,value,href])=><div className="col-12 col-md-6 col-xl-4" key={String(title)}>
        <Link className="card h-100 text-decoration-none text-body shadow-sm" href={String(href)}><div className="card-body d-flex align-items-center justify-content-between">
          <span>{title}</span><strong className="fs-4">{value}</strong></div></Link>
      </div>)}</div>
    </>}
  </main>;
}
