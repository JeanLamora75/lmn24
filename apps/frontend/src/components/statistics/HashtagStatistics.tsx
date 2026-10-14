"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HashtagThumbnail } from "@/components/hashtags/HashtagThumbnail";

type Period = "24h" | "7d" | "30d";
type Topic = { id: string; name: string; slug: string; imageUrl: string | null };
type Ranked = Topic & {
  mentions: number; previousMentions: number | null;
  changePercent: number | null; changeLabel: string; trendScore: number | null;
};
type TopicOption = Pick<Topic, "id" | "name" | "slug">;
type HashtagReport = {
  period: Period; asOf: string; calculatedAt: string; scope: "global";
  indicators: { registered: number; active: number; activeRate: number | null;
    aliases: number; mentions: number | null; cited: number | null;
    trending: number | null };
  top: { mostCited: Ranked[]; trending: Ranked[];
    comparisonAvailable: boolean; comparisonReason: string | null };
  timeline: {
    available: boolean; reason: string | null;
    selected: (TopicOption & { color: string })[];
    options: TopicOption[];
    points: { at: string; values: number[] }[];
    bucket: "hour" | "trailing-24h";
  };
  quality: { activeDenominator: number;
    withoutAlias: number; withoutAliasExamples: TopicOption[];
    withoutImage: number; withoutImageExamples: TopicOption[];
    averageAliases: number | null;
    uncitedPeriod: number | null; uncited30d: number | null;
    uncitedCoverage: number | null };
  health: {
    freshness: "fresh" | "stale" | "unverified";
    comparisonAvailable: boolean; comparisonReason: string | null;
    comparison30dAvailable: boolean; comparison30dReason: string | null;
    lastFullRebuildAt: string | null; coverageSinceUtc: string | null;
    bucketCount: number; firstHour: string | null; lastHour: string | null;
    calculatedAt: string; currentPeriodCovered: boolean;
  };
};
const PERIODS = [
  { id: "24h" as const, label: "24 heures" },
  { id: "7d" as const, label: "7 jours" },
  { id: "30d" as const, label: "30 jours" },
];
const fmt = (value: number | null) => value === null ? "N/A" :
  new Intl.NumberFormat("fr-FR").format(value);
const utcDate = (iso: string | null) => iso
  ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", dateStyle: "short",
    timeStyle: "short" }).format(new Date(iso)) + " UTC" : "N/A";

function Summary({ name, value, detail }: {
  name: string; value: number | null; detail?: string;
}) {
  return <div className="col-6 col-lg-4 col-xl-2">
    <div className="card shadow-sm h-100"><div className="card-body">
      <div className="small text-body-secondary mb-2">{name}</div>
      <strong className="fs-3">{fmt(value)}</strong>
      {detail && <p className="small text-body-secondary mt-2 mb-0">{detail}</p>}
    </div></div>
  </div>;
}
function Panel({ title, children }: {
  title: string; children: React.ReactNode;
}) {
  return <section className="card h-100 shadow-sm" style={{ minWidth: 0 }}>
    <div className="card-body p-4" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <h3 className="h5 mb-3">{title}</h3>{children}
    </div>
  </section>;
}

function Ranking({ items, trending }: { items: Ranked[]; trending?: boolean }) {
  if (!items.length) return <p className="text-body-secondary mb-0">
    Aucun sujet ne correspond aux critères pour cette période.
  </p>;
  const max = Math.max(1, ...items.map((item) => item.mentions));
  return <ol className="list-unstyled d-grid gap-3 mb-0">
    {items.map((item, index) => (
      <li key={item.id}>
        <div className="d-flex gap-2 align-items-center">
          <span className="text-body-secondary small" style={{ width: 22 }}>
            {index + 1}.
          </span>
          <div style={{ width: 56, flexShrink: 0, overflow: "hidden", borderRadius: 5 }}>
            <HashtagThumbnail imageUrl={item.imageUrl} name={item.name}/>
          </div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex justify-content-between align-items-start gap-2">
              <Link href={"/fr/hashtags/" + encodeURIComponent(item.slug)}
                className="fw-semibold text-decoration-none text-break">{item.name}</Link>
              <span className="text-nowrap">
                <strong>{fmt(item.mentions)}</strong>
                {trending && <span className="ms-2 text-success small">
                  {item.previousMentions === 0 ? "Nouveau"
                    : item.previousMentions === null ? "N/A" : item.changeLabel}
                </span>}
              </span>
            </div>
            <div className="progress mt-1" style={{ height: 8 }} role="progressbar"
              aria-label={item.name + " : " + item.mentions + " mentions"}
              aria-valuemin={0} aria-valuemax={max} aria-valuenow={item.mentions}>
              <div className={"progress-bar" + (trending ? " bg-success" : "")}
                style={{ width: (item.mentions / max * 100) + "%" }}/>
            </div>
          </div>
        </div>
      </li>
    ))}
  </ol>;
}

function MentionsChart({ timeline, period, setIds }: {
  timeline: HashtagReport["timeline"]; period: Period;
  setIds: (ids: string[]) => void;
}) {
  const selectedIds = timeline.selected.map((row) => row.id);
  const maximum = Math.max(1, ...timeline.points.flatMap((row) => row.values));
  const points = timeline.points;
  const x = (index: number) => 50 + (points.length <= 1 ? 0 :
    index * 815 / (points.length - 1));
  const y = (value: number) => 205 - value / maximum * 165;
  return <>
    <p className="small text-body-secondary">
      {period === "24h" ? "Buckets horaires" :
        "Buckets de 24 heures consécutives, ancrés sur l'heure UTC du classement"}.
      {" "}Cinq hashtags maximum.
    </p>
    <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
      {timeline.selected.map((item) =>
        <button key={item.id} type="button" className="btn btn-sm btn-outline-secondary"
          style={{ borderColor: item.color }}
          title={"Retirer " + item.name}
          disabled={selectedIds.length === 1}
          onClick={() => setIds(selectedIds.filter((id) => id !== item.id))}>
          <span style={{ color: item.color }}>●</span> {item.name} ×
        </button>,
      )}
      <label className="visually-hidden" htmlFor="hashtag-add-chart">Ajouter un hashtag</label>
      <select id="hashtag-add-chart" className="form-select form-select-sm"
        style={{ maxWidth: 280 }} value=""
        disabled={selectedIds.length >= 5}
        onChange={(event) => {
          if (event.target.value && !selectedIds.includes(event.target.value)) {
            setIds([...selectedIds, event.target.value]);
          }
        }}>
        <option value="">Ajouter un hashtag…</option>
        {timeline.options.filter((topic) => !selectedIds.includes(topic.id))
          .map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
      </select>
    </div>
    {!timeline.available ? <p className="alert alert-warning" role="status">
      {timeline.reason ?? "Historique indisponible."}
    </p> : !points.length || !timeline.selected.length
      ? <p className="text-body-secondary">Aucune donnée à représenter.</p>
      : <>
        <svg viewBox="0 0 900 245" width="100%" height="260"
          role="img" aria-label={"Courbes des mentions UTC de " +
            timeline.selected.map((x) => x.name).join(", ")}>
          {[0, .25, .5, .75, 1].map((ratio) => {
            const height = y(ratio * maximum);
            return <g key={ratio}>
              <line x1="50" x2="865" y1={height} y2={height}
                stroke="currentColor" strokeOpacity=".13"/>
              <text x="43" y={height + 4} textAnchor="end" fontSize="12"
                fill="currentColor">{Math.round(ratio * maximum)}</text>
            </g>;
          })}
          {timeline.selected.map((item, seriesIndex) =>
            <polyline key={item.id} fill="none" stroke={item.color} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              points={points.map((p, i) => x(i) + "," + y(p.values[seriesIndex] ?? 0))
                .join(" ")} />,
          )}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1]
            .filter((v, index, all) => all.indexOf(v) === index).map((index) =>
              <text key={index} x={x(index)} y="233" fontSize="12"
                textAnchor={index === 0 ? "start" : index === points.length - 1
                  ? "end" : "middle"} fill="currentColor">
                {new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC",
                  day: "2-digit", month: "2-digit", hour: "2-digit" })
                  .format(new Date(points[index]!.at))}
              </text>,
            )}
        </svg>
        <details className="mt-2">
          <summary className="small">Consulter les valeurs de chaque période (accessible)</summary>
          <div className="table-responsive mt-2" style={{ maxHeight: 300 }}>
            <table className="table table-sm">
              <thead><tr><th>Début du bucket UTC</th>
                {timeline.selected.map((item) => <th key={item.id}>{item.name}</th>)}
              </tr></thead>
              <tbody>{points.map((point) => <tr key={point.at}>
                <td>{utcDate(point.at)}</td>
                {point.values.map((value, i) =>
                  <td key={timeline.selected[i]?.id ?? i}>{fmt(value)}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
  </>;
}

function QualityItem({ name, count, examples, denominator }: {
  name: string; count: number; examples: TopicOption[]; denominator: number;
}) {
  return <div className="mb-3">
    <div className="d-flex justify-content-between gap-2">
      <span>{name}</span>
      <strong>{fmt(count)} / {fmt(denominator)}</strong>
    </div>
    <div className="progress my-1" style={{ height: 9 }}>
      <div className="progress-bar bg-warning" role="progressbar"
        aria-label={name} aria-valuemin={0} aria-valuemax={denominator}
        aria-valuenow={count}
        style={{ width: (denominator ? count / denominator * 100 : 0) + "%" }}/>
    </div>
    {examples.length > 0 && <p className="small text-body-secondary mb-0">
      Exemples : {examples.map((topic, i) => <span key={topic.id}>
        {i > 0 ? ", " : ""}
        <Link href={"/admin/hashtags/" + topic.id + "/edit"}>{topic.name}</Link>
      </span>)}
    </p>}
  </div>;
}

export function HashtagStatistics() {
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<HashtagReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period });
    if (selectedIds.length) params.set("ids", selectedIds.join(","));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/admin/statistics/hashtags?" + params, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Statistiques hashtags indisponibles (" +
        response.status + ").");
      return await response.json() as HashtagReport;
    }).then((report) => {
      if (!controller.signal.aborted) setData(report);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(
        reason instanceof Error ? reason.message : "Erreur de chargement.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, selectedIds, revision]);

  return <section aria-labelledby="hashtag-statistics-title" className="mb-4">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div>
        <h2 className="h4 mb-1" id="hashtag-statistics-title">Statistiques Hashtags</h2>
        <p className="small text-body-secondary mb-0">
          Tous pays, toutes sources, toutes langues, toutes catégories —
          période Hashtags indépendante des filtres généraux.
        </p>
      </div>
      <div className="d-flex align-items-end gap-2">
        <div><label className="form-label small" htmlFor="hashtag-stats-period">
          Période Hashtags</label>
          <select id="hashtag-stats-period" className="form-select"
            value={period} onChange={(event) => {
              setPeriod(event.target.value as Period); setSelectedIds([]);
            }}>
            {PERIODS.map((p) => <option value={p.id} key={p.id}>{p.label}</option>)}
          </select></div>
        <button className="btn btn-outline-primary" type="button"
          disabled={loading} onClick={refresh}>Actualiser</button>
      </div>
    </div>
    {error && <div className="alert alert-danger" role="alert">
      {error} <button className="btn btn-sm btn-outline-danger ms-2"
        onClick={refresh}>Réessayer</button>
    </div>}
    {loading && <p className="alert alert-info" role="status">Actualisation des hashtags…</p>}
    {!data ? null : <>
      <div className="small text-body-secondary mb-3">
        Heure UTC de référence : {utcDate(data.asOf)} · Calcul : {utcDate(data.calculatedAt)}
      </div>
      <div className="row g-3 mb-4">
        <Summary name="Hashtags enregistrés" value={data.indicators.registered}
          detail="Stock, actifs et inactifs"/>
        <Summary name="Hashtags actifs" value={data.indicators.active}
          detail={data.indicators.activeRate === null ? "N/A" :
            data.indicators.activeRate + " % du total"}/>
        <Summary name="Alias enregistrés" value={data.indicators.aliases}
          detail="Tous hashtags confondus"/>
        <Summary name="Mentions" value={data.indicators.mentions}
          detail="Associations article × hashtag, pas articles uniques"/>
        <Summary name="Sujets cités" value={data.indicators.cited}
          detail="Actifs avec au moins une mention"/>
        <Summary name="Sujets en tendance" value={data.indicators.trending}
          detail={data.top.comparisonAvailable ? "Selon les seuils configurés" :
            "Comparaison indisponible : N/A"}/>
      </div>
      {!data.health.currentPeriodCovered && <div className="alert alert-warning" role="status">
        Les compteurs de cette période ne sont pas suffisamment vérifiés :
        les KPI temporels et les courbes sont indisponibles. Les classements peuvent
        toutefois présenter des valeurs provisoires, sans garantie de couverture.
      </div>}
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <Panel title="Top 10 — Hashtags les plus cités">
            <Ranking items={data.top.mostCited}/>
          </Panel>
        </div>
        <div className="col-12 col-xl-6">
          <Panel title="Top 10 — Tendances">
            {!data.top.comparisonAvailable
              ? <p className="alert alert-warning" role="status">
                Comparaison N/A : {data.top.comparisonReason ??
                  "Historique insuffisant ou reconstruction nécessaire."}
              </p> : <Ranking items={data.top.trending} trending/>}
          </Panel>
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-12">
          <Panel title="Évolution des mentions — comparer jusqu'à 5 hashtags">
            <MentionsChart timeline={data.timeline} period={period}
              setIds={setSelectedIds}/>
          </Panel>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <Panel title="Qualité et couverture du référentiel">
            <p className="small text-body-secondary">
              Les indicateurs de qualité concernent les {fmt(data.quality.activeDenominator)}
              {" "}hashtags actifs.
            </p>
            <QualityItem name="Sans alias" count={data.quality.withoutAlias}
              denominator={data.quality.activeDenominator}
              examples={data.quality.withoutAliasExamples}/>
            <QualityItem name="Sans image" count={data.quality.withoutImage}
              denominator={data.quality.activeDenominator}
              examples={data.quality.withoutImageExamples}/>
            <p>Alias par hashtag actif :{" "}
              <strong>{data.quality.averageAliases ?? "N/A"}</strong></p>
            <p>Sans mention sur la période :{" "}
              <strong>{fmt(data.quality.uncitedPeriod)}</strong></p>
            <p>Sans mention sur les 30 derniers jours :{" "}
              <strong>{fmt(data.quality.uncited30d)}</strong></p>
            <p>Sans mention depuis le début de couverture vérifiée :{" "}
              <strong>{fmt(data.quality.uncitedCoverage)}</strong></p>
            <Link href="/admin/hashtags" className="btn btn-outline-primary btn-sm">
              Administrer les hashtags
            </Link>
          </Panel>
        </div>
        <div className="col-12 col-lg-6">
          <Panel title="Santé des statistiques Hashtags">
            <div className="mb-3">
              <span className={"badge " + (data.health.freshness === "fresh"
                ? "text-bg-success" : "text-bg-warning")}>
                {data.health.freshness === "fresh" ? "Reconstruction récente"
                  : data.health.freshness === "stale" ? "Reconstruction trop ancienne"
                    : "Historique non vérifié"}
              </span>
            </div>
            <dl className="row small">
              <dt className="col-6">Dernière reconstruction complète</dt>
              <dd className="col-6">{utcDate(data.health.lastFullRebuildAt)}</dd>
              <dt className="col-6">Début de couverture historique</dt>
              <dd className="col-6">{utcDate(data.health.coverageSinceUtc)}</dd>
              <dt className="col-6">Buckets horaires conservés</dt>
              <dd className="col-6">{fmt(data.health.bucketCount)}</dd>
              <dt className="col-6">Premier / dernier bucket</dt>
              <dd className="col-6">{utcDate(data.health.firstHour)} —{" "}
                {utcDate(data.health.lastHour)}</dd>
              <dt className="col-6">Dernier calcul</dt>
              <dd className="col-6">{utcDate(data.health.calculatedAt)}</dd>
              <dt className="col-6">Comparaison fiable 30 j / 30 j</dt>
              <dd className="col-6">{data.health.comparison30dAvailable
                ? "Disponible" : "N/A — historique insuffisant"}</dd>
            </dl>
            {!data.health.comparison30dAvailable && <p className="small text-warning-emphasis">
              {data.health.comparison30dReason ??
                "Une reconstruction ou un historique plus long est nécessaire."}
            </p>}
            <div className="d-flex flex-wrap gap-2">
              <Link href="/admin/hashtag-trends" className="btn btn-outline-primary btn-sm">
                Paramètres Tendances
              </Link>
              <Link href={"/fr/hashtags?period=" + period} className="btn btn-outline-secondary btn-sm">
                Classement public
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>}
  </section>;
}
