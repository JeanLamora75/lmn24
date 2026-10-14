"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Table = "article" | "video" | "feed_run" | "feed_video_run" | "hashtag_hourly_count";
type Mode = "expired" | "all";
type Preview = {
  token: string; table: Table; mode: Mode; count: number;
  cutoff: string | null; expiresAt: string; warnings: string[];
};
type Job = {
  id: string; table: Table; mode: Mode;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "ERROR";
  startedAt: string; finishedAt: string | null;
  deleted: number; previewCount: number; message: string | null;
  durationMs: number | null;
};

const TABLES: ReadonlyArray<{ key: Table; title: string; note: string }> = [
  { key: "article", title: "Articles d’actualité",
    note: "Après suppression, les statistiques hashtags seront reconstruites." },
  { key: "video", title: "Vidéos YouTube",
    note: "Ne supprime ni les sources ni les flux vidéos." },
  { key: "feed_run", title: "Historique du Parser Infos",
    note: "Les exécutions RUNNING sont toujours protégées." },
  { key: "feed_video_run", title: "Historique du Parser Vidéos",
    note: "Les exécutions RUNNING sont toujours protégées." },
  { key: "hashtag_hourly_count", title: "Compteurs horaires des hashtags",
    note: "Les classements seront non vérifiés jusqu'à une reconstruction." },
];

async function getError(response: Response): Promise<string> {
  try {
    const value = await response.json() as { message?: string | string[] };
    return Array.isArray(value.message) ? value.message.join(" ")
      : value.message || "Opération impossible.";
  } catch { return "Opération impossible."; }
}

function prettyDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function ManualPurgeScreen() {
  const router = useRouter();
  const [table, setTable] = useState<Table>("article");
  const [mode, setMode] = useState<Mode>("expired");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);

  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/manual-purge/jobs", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await getError(response));
      const body = await response.json() as { jobs: Job[] };
      setJobs(body.jobs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Historique indisponible.");
    }
  }, [router]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const activeJob = jobs.some(job => job.status === "RUNNING" || job.status === "PENDING");
  useEffect(() => {
    if (!activeJob) return;
    const timer = setInterval(() => { void refreshJobs(); }, 1500);
    return () => clearInterval(timer);
  }, [activeJob, refreshJobs]);

  function selectTable(key: Table) {
    setTable(key); setPreview(null); setTyped(""); setConfirm(false);
    setError(""); setNotice("");
  }
  function selectMode(value: Mode) {
    setMode(value); setPreview(null); setTyped(""); setConfirm(false);
    setError(""); setNotice("");
  }
  async function loadPreview() {
    if (activeJob) return;
    setLoading(true); setPreview(null); setConfirm(false); setTyped("");
    setError(""); setNotice("");
    try {
      const query = new URLSearchParams({ table, mode });
      const response = await fetch("/api/admin/manual-purge/preview?" + query, {
        cache: "no-store",
      });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await getError(response));
      setPreview(await response.json() as Preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prévisualisation impossible.");
    } finally { setLoading(false); }
  }

  async function execute() {
    if (!preview || preview.count === 0 || !confirm || activeJob || launching) return;
    if (mode === "all" && typed !== table) return;
    if (preview.table !== table || preview.mode !== mode) return;
    if (Date.now() > new Date(preview.expiresAt).getTime()) {
      setError("Prévisualisation expirée. Réactualisez-la avant toute suppression.");
      setPreview(null);
      return;
    }
    setLaunching(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/manual-purge/execute", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          table, mode, token: preview.token, confirmed: true,
          ...(mode === "all" ? { typedName: typed } : {}),
        }),
      });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await getError(response));
      const job = await response.json() as Job;
      setPreview(null); setConfirm(false); setTyped("");
      setNotice("Purge " + job.id + " acceptée. Consultez son résultat ci-dessous.");
      await refreshJobs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lancement impossible.");
    } finally { setLaunching(false); }
  }

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h2 mb-1">Purge manuelle des données</h1>
          <p className="text-body-secondary mb-0">
            Choisir une seule table et une seule opération à la fois.
          </p>
        </div>
        <Link className="btn btn-outline-secondary" href="/admin">Retour administration</Link>
      </div>
      <div className="alert alert-danger" role="note">
        <strong>Action irréversible.</strong> Sauvegardez votre base avant une purge.
        Les tables de référence, utilisateurs, sources, paramètres et flux ne sont jamais proposées.
        Ne lancez pas un vidage complet sur une base de production sans sauvegarde vérifiée.
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card shadow-sm mb-4" aria-label="Choix de la table">
        <div className="card-body p-4">
          <h2 className="h5">1. Sélectionnez la table</h2>
          <div className="row g-2">
            {TABLES.map(item => (
              <div key={item.key} className="col-12">
                <label className={"d-block p-3 rounded border " +
                  (item.key === table ? "border-primary bg-body-tertiary" : "")}
                  style={{ cursor: "pointer" }}>
                  <input type="radio" name="purge-table" value={item.key}
                    className="form-check-input me-3"
                    disabled={activeJob || loading || launching}
                    checked={table === item.key} onChange={() => selectTable(item.key)} />
                  <strong>{item.title}</strong>{" "}
                  <code>{item.key}</code>
                  <div className="small text-body-secondary mt-1 ms-4">{item.note}</div>
                </label>
              </div>
            ))}
          </div>

          <h2 className="h5 mt-4">2. Sélectionnez le type de purge</h2>
          <div className="d-flex flex-wrap gap-3">
            <label>
              <input type="radio" className="form-check-input me-2"
                name="purge-mode" checked={mode === "expired"}
                disabled={activeJob || loading || launching}
                onChange={() => selectMode("expired")} />
              Purger les enregistrements expirés
            </label>
            <label>
              <input type="radio" className="form-check-input me-2"
                name="purge-mode" checked={mode === "all"}
                disabled={activeJob || loading || launching}
                onChange={() => selectMode("all")} />
              Vider entièrement la table
            </label>
          </div>

          <button type="button" className="btn btn-outline-primary mt-4"
            disabled={activeJob || loading || launching} onClick={() => void loadPreview()}>
            {loading ? "Prévisualisation…" : "Prévisualiser la purge"}
          </button>
        </div>
      </section>

      {preview && (
        <section className="card border-warning shadow-sm mb-4" aria-label="Confirmation de purge">
          <div className="card-body p-4">
            <h2 className="h5">3. Vérifiez et confirmez</h2>
            <dl className="row mb-3">
              <dt className="col-sm-4">Table</dt><dd className="col-sm-8"><code>{preview.table}</code></dd>
              <dt className="col-sm-4">Type de purge</dt><dd className="col-sm-8">
                {preview.mode === "expired" ? "Enregistrements expirés" : "Vidage complet"}
              </dd>
              <dt className="col-sm-4">Enregistrements candidats</dt>
              <dd className="col-sm-8 fw-semibold">{preview.count.toLocaleString("fr-FR")}</dd>
              {preview.cutoff && (
                <><dt className="col-sm-4">Avant le</dt>
                <dd className="col-sm-8">{prettyDate(preview.cutoff)}</dd></>
              )}
            </dl>
            {preview.warnings.map(warning => (
              <p className="alert alert-warning" key={warning}>{warning}</p>
            ))}
            {preview.count === 0 ? (
              <p className="alert alert-info" role="status">Aucun enregistrement à supprimer.</p>
            ) : (
              <>
                {mode === "all" && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="confirm-name">
                      Pour confirmer le vidage complet, saisissez exactement <strong>{table}</strong>.
                    </label>
                    <input className="form-control" id="confirm-name" value={typed}
                      autoComplete="off" spellCheck={false}
                      onChange={event => setTyped(event.target.value)} />
                  </div>
                )}
                <label className="form-check-label d-block mb-3">
                  <input className="form-check-input me-2" type="checkbox"
                    checked={confirm} onChange={event => setConfirm(event.target.checked)} />
                  Je comprends que cette suppression est irréversible.
                </label>
                <button type="button" className="btn btn-danger"
                  disabled={!confirm || launching || activeJob ||
                    (mode === "all" && typed !== table)}
                  onClick={() => void execute()}>
                  {launching ? "Démarrage…" : "Confirmer la suppression"}
                </button>
                <button type="button" className="btn btn-outline-secondary ms-2"
                  onClick={() => setPreview(null)}>Annuler</button>
              </>
            )}
            <p className="form-text mt-3 mb-0">
              La confirmation expire au bout de trois minutes. Une nouvelle prévisualisation
              est obligatoire si les données ont changé.
            </p>
          </div>
        </section>
      )}

      <section className="card shadow-sm" aria-label="Suivi des purges">
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <h2 className="h5 mb-0">Exécutions récentes</h2>
            <button type="button" className="btn btn-outline-secondary btn-sm"
              onClick={() => void refreshJobs()}>Actualiser</button>
          </div>
          {jobs.length === 0 ? <p className="text-body-secondary mt-3 mb-0">
            Aucune purge exécutée depuis le dernier démarrage du backend.
          </p> : (
            <div className="table-responsive mt-3">
              <table className="table table-sm align-middle">
                <thead><tr><th>Table</th><th>Mode</th><th>Statut</th>
                  <th>Supprimés</th><th>Début</th><th>Durée</th></tr></thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
                      <td><code>{job.table}</code></td>
                      <td>{job.mode === "all" ? "Total" : "Expirés"}</td>
                      <td>
                        <span className={"badge " + (job.status === "COMPLETED" ? "text-bg-success"
                          : job.status === "ERROR" ? "text-bg-danger" : "text-bg-info")}>
                          {job.status}
                        </span>
                        {job.message && <div className="small text-danger">{job.message}</div>}
                      </td>
                      <td>{job.deleted.toLocaleString("fr-FR")}</td>
                      <td>{prettyDate(job.startedAt)}</td>
                      <td>{job.durationMs === null ? "—" : Math.round(job.durationMs / 1000) + " s"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="form-text mb-0">
            Historique de session serveur ; les journaux applicatifs enregistrent les opérations.
            Une interruption du backend annule toute transaction de suppression non validée.
          </p>
        </div>
      </section>
    </main>
  );
}
