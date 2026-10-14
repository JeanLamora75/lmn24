"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Key = "hashtagTrendMinMentions" | "hashtagTrendMinIncrease" | "hashtagTrendScoreFloor";
type Settings = Record<Key, number>;
const FIELDS: readonly Readonly<{ key: Key; label: string; explanation: string }>[] = [
  { key: "hashtagTrendMinMentions", label: "Nombre minimum de mentions",
    explanation: "Nombre d'articles distincts mentionnant le sujet dans la période actuelle." },
  { key: "hashtagTrendMinIncrease", label: "Progression minimum (mentions supplémentaires)",
    explanation: "Hausse minimale du nombre d'articles par rapport à la période précédente de même durée." },
  { key: "hashtagTrendScoreFloor", label: "Plancher du score",
    explanation: "Minimum utilisé au dénominateur du score pour éviter de survaloriser les très petits volumes." },
];
async function errorText(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(" ") : body.message ?? "Opération impossible.";
  } catch { return "Opération impossible."; }
}

export function HashtagTrendSettings() {
  const router = useRouter();
  const [values, setValues] = useState<Record<Key, string>>({
    hashtagTrendMinMentions: "", hashtagTrendMinIncrease: "", hashtagTrendScoreFloor: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/hashtag-trend-settings", {
          cache: "no-store", signal: controller.signal,
        });
        if (response.status === 401) { router.replace("/admin/login"); return; }
        if (!response.ok) throw new Error(await errorText(response));
        const body = await response.json() as Settings;
        if (!controller.signal.aborted) {
          setValues({
            hashtagTrendMinMentions: String(body.hashtagTrendMinMentions),
            hashtagTrendMinIncrease: String(body.hashtagTrendMinIncrease),
            hashtagTrendScoreFloor: String(body.hashtagTrendScoreFloor),
          });
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Chargement impossible.");
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    const request = {} as Settings;
    for (const field of FIELDS) {
      const value = values[field.key];
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) ||
          Number(value) < 1 || Number(value) > 1_000_000_000) {
        setError("Saisissez trois entiers strictement positifs (maximum 1 milliard).");
        return;
      }
      request[field.key] = Number(value);
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/hashtag-trend-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await errorText(response));
      const saved = await response.json() as Settings;
      setValues({
        hashtagTrendMinMentions: String(saved.hashtagTrendMinMentions),
        hashtagTrendMinIncrease: String(saved.hashtagTrendMinIncrease),
        hashtagTrendScoreFloor: String(saved.hashtagTrendScoreFloor),
      });
      setSuccess("Seuils enregistrés. Les classements seront recalculés avec ces valeurs sans réanalyser les articles.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Échec de l'enregistrement.");
    } finally { setSaving(false); }
  }

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex justify-content-between flex-wrap align-items-center gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Paramètres des tendances</h1>
          <p className="text-body-secondary mb-0">Détection des sujets en forte progression dans l’actualité mondiale.</p>
        </div>
        <Link className="btn btn-outline-secondary" href="/admin">Retour administration</Link>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}
      <form onSubmit={(event) => void submit(event)} className="card shadow-sm p-4" style={{ maxWidth: 760 }}>
        {loading ? <p>Chargement des paramètres…</p> : FIELDS.map((field) => (
          <div className="mb-4" key={field.key}>
            <label htmlFor={field.key} className="form-label fw-semibold">{field.label}</label>
            <input id={field.key} className="form-control" type="number" min="1" max="1000000000"
              step="1" required value={values[field.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))} />
            <div className="form-text">{field.explanation}</div>
          </div>
        ))}
        <div className="alert alert-light border small" role="note">
          Ces valeurs sont communes aux périodes 24 h, 7 jours et 30 jours. 
          Les tendances ne sont calculées que lorsque l’historique et une reconstruction complète récente sont disponibles.
          Le score sert au tri ; le pourcentage affiché au public reste une variation réelle.
        </div>
        <div className="d-flex justify-content-end gap-2">
          <Link href="/admin" className="btn btn-outline-secondary">Annuler</Link>
          <button className="btn btn-primary" type="submit" disabled={saving || loading}>
            {saving ? "Enregistrement…" : "Enregistrer les seuils"}
          </button>
        </div>
      </form>
    </main>
  );
}
