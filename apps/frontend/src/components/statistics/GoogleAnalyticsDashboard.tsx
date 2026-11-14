"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminIcon } from "@/components/admin/AdminIcon";

type Ranked = { name: string; value: number };
type Report = {
  configured: boolean;
  propertyId: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  daily: Ranked[];
  countries: Ranked[];
  devices: Ranked[];
};

const number = (value: number): string => new Intl.NumberFormat("fr-FR").format(value);

function Ranking({ title, items }: { title: string; items: Ranked[] }) {
  const highest = Math.max(1, ...items.map(item => item.value));
  return (
    <section className="card shadow-sm h-100">
      <div className="card-body">
        <h2 className="h5 mb-3">{title}</h2>
        {items.length ? items.map(item => (
          <div key={item.name} className="mb-3">
            <div className="d-flex justify-content-between gap-2 small">
              <span>{item.name}</span><strong>{number(item.value)}</strong>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <div className="progress-bar" style={{ width: `${item.value / highest * 100}%` }} />
            </div>
          </div>
        )) : <p className="text-body-secondary">Aucune donnée sur cette période.</p>}
      </div>
    </section>
  );
}

export function GoogleAnalyticsDashboard() {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/admin/statistics/google-analytics?period=" + period, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      const body = await response.json() as Report & { message?: string };
      if (!response.ok) throw new Error(body.message || "Impossible de lire les données GA4.");
      return body;
    }).then(body => {
      if (!controller.signal.aborted) setData(body);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Lecture indisponible.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [period, refresh]);

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <header className="mb-4">
        <Link href="/admin" className="btn btn-sm btn-outline-secondary mb-3">
          <AdminIcon name="arrow-left" className="me-2" /> Administration
        </Link>
        <h1 className="h2">Statistiques du site</h1>
        <p className="text-body-secondary">Audience Google Analytics 4, séparée des statistiques éditoriales LMN24.</p>
      </header>
      <nav className="d-flex gap-2 mb-4" aria-label="Sources de statistiques">
        <Link href="/admin/site-statistics" className="btn btn-outline-secondary">Statistiques LMN24</Link>
        <span className="btn btn-primary" aria-current="page">Google Analytics</span>
      </nav>
      <div className="d-flex gap-2 align-items-center flex-wrap mb-4">
        <label htmlFor="ga4-period" className="form-label mb-0">Période</label>
        <select id="ga4-period" className="form-select w-auto" value={period}
          onChange={event => setPeriod(event.target.value === "30d" ? "30d" : "7d")}>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
        </select>
        <button type="button" className="btn btn-outline-secondary" onClick={() => setRefresh(x => x + 1)} disabled={loading}>
          <AdminIcon name="arrow-clockwise" className="me-2" /> Actualiser
        </button>
      </div>
      {error ? <div className="alert alert-warning" role="alert">{error}</div> : null}
      {loading ? <p role="status">Chargement des données Google Analytics…</p> : null}
      {data ? <>
        <p className="small text-body-secondary">Propriété GA4 : {data.propertyId}. Les statistiques peuvent avoir un délai de traitement.</p>
        <div className="row g-3 mb-4">
          {[
            ["Utilisateurs actifs", data.activeUsers],
            ["Sessions", data.sessions],
            ["Pages vues", data.screenPageViews],
          ].map(([label, value]) => (
            <div className="col-12 col-md-4" key={label}>
              <div className="card shadow-sm h-100"><div className="card-body">
                <div className="text-body-secondary small">{label}</div>
                <strong className="fs-2">{number(value as number)}</strong>
              </div></div>
            </div>
          ))}
        </div>
        <div className="row g-3">
          <div className="col-12 col-lg-6"><Ranking title="Audience quotidienne" items={data.daily.map(d => ({
            ...d, name: d.name.replace(/^(\d{4})(\d{2})(\d{2})$/, "$3/$2/$1"),
          }))} /></div>
          <div className="col-12 col-lg-3"><Ranking title="Pays" items={data.countries} /></div>
          <div className="col-12 col-lg-3"><Ranking title="Appareils" items={data.devices} /></div>
        </div>
      </> : null}
    </main>
  );
}
