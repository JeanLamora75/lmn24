"use client";

import {
  RETENTION_MAX_DAYS, RETENTION_SETTING_KEYS, type RetentionSettingKey,
} from "@lmn24/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type Values = Record<RetentionSettingKey, number>;
type Group = Readonly<{
  heading: string;
  hint: string;
  fields: readonly Readonly<{
    key: RetentionSettingKey;
    label: string;
    note: string;
  }>[];
}>;

const GROUPS: readonly Group[] = [
  {
    heading: "Contenus publiés",
    hint: "Durées fondées sur la date de publication.",
    fields: [
      { key: "retentionArticlesDays", label: "Articles d’actualité",
        note: "Articles RSS/XML ; les compteurs des hashtags seront réconciliés lors des purges." },
      { key: "retentionHoroscopesDays", label: "Horoscopes",
        note: "Conservation des horoscopes par date civile. Les fichiers JSON sources et historiques d'import sont préservés." },
      { key: "retentionVideosDays", label: "Vidéos YouTube",
        note: "Vidéos conservées selon leur date de publication sur YouTube." },
    ],
  },
  {
    heading: "Historiques d’exécution",
    hint: "Les exécutions encore en cours ne doivent jamais être purgées.",
    fields: [
      { key: "retentionInfoParserRunsDays", label: "Exécutions du Parser Infos",
        note: "Historique des collectes de flux d’actualité." },
      { key: "retentionVideoParserRunsDays", label: "Exécutions du Parser Vidéos",
        note: "Historique des collectes de flux vidéo." },
      { key: "weatherRunRetentionDays", label: "Exécutions du Parser Météo",
        note: "Historique weather_run ; les collectes RUNNING sont protégées." },
    ],
  },
  {
    heading: "Relevés météorologiques",
    hint: "Les villes du référentiel sont toujours conservées.",
    fields: [
      { key: "weatherCurrentRetentionDays", label: "Derniers relevés météo",
        note: "Relevés weather_current anciens selon observed_at, sans supprimer les villes. La purge manuelle pourra recollecter les données." },
    ],
  },
  {
    heading: "Logs techniques locaux",
    hint: "Ces réglages ne concernent que les fichiers locaux contrôlés par LMN24.",
    fields: [
      { key: "retentionInfoParserLogsDays", label: "Logs du Parser Infos",
        note: "N’affecte pas les journaux de l’hébergeur ou d’un service externe." },
      { key: "retentionVideoParserLogsDays", label: "Logs du Parser Vidéos",
        note: "N’affecte pas les journaux de l’hébergeur ou d’un service externe." },
      { key: "retentionBackendLogsDays", label: "Logs du backend",
        note: "N’affecte pas les journaux externalisés ni les sauvegardes." },
    ],
  },
  {
    heading: "Statistiques hashtags",
    hint: "Réglage distinct de la conservation des articles.",
    fields: [
      { key: "retentionHashtagHourlyCountsDays", label: "Compteurs horaires des hashtags",
        note: "Les tendances sur 30 jours comparées aux 30 jours précédents nécessitent 60 jours disponibles." },
    ],
  },
];

const INPUT_KEYS = new Set<RetentionSettingKey>(RETENTION_SETTING_KEYS);

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(" ")
      : body.message || "Enregistrement impossible.";
  } catch { return "Enregistrement impossible."; }
}

export function RetentionSettings() {
  const router = useRouter();
  const [saved, setSaved] = useState<Values | null>(null);
  const [draft, setDraft] = useState<Partial<Record<RetentionSettingKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<RetentionSettingKey | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/retention-settings", {
          signal: controller.signal, cache: "no-store",
        });
        if (response.status === 401) { router.replace("/admin/login"); return; }
        if (!response.ok) throw new Error(await responseError(response));
        const body = await response.json() as { values?: Partial<Values> };
        const incoming = body.values;
        if (!incoming || RETENTION_SETTING_KEYS.some((key) =>
          !Number.isSafeInteger(incoming[key]) || (incoming[key] ?? 0) < 1 ||
          (incoming[key] ?? 0) > RETENTION_MAX_DAYS)) {
          throw new Error("Le serveur a retourné une configuration incomplète.");
        }
        if (!controller.signal.aborted) {
          const values = incoming as Values;
          setSaved(values);
          setDraft(Object.fromEntries(RETENTION_SETTING_KEYS.map(
            (key) => [key, String(values[key])],
          )) as Record<RetentionSettingKey, string>);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Chargement impossible.");
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [router]);

  const save = async (event: FormEvent<HTMLFormElement>, key: RetentionSettingKey) => {
    event.preventDefault();
    if (!saved || savingKey !== null || !INPUT_KEYS.has(key)) return;
    const entered = draft[key] ?? "";
    if (!/^\d+$/.test(entered) || !Number.isSafeInteger(Number(entered)) ||
      Number(entered) < 1 || Number(entered) > RETENTION_MAX_DAYS) {
      setError("Veuillez saisir un nombre entier entre 1 et 3650 jours.");
      setNotice("");
      return;
    }
    const days = Number(entered);
    const previous = saved[key];
    if (days === previous) return;
    const isDecrease = days < previous;
    if (isDecrease && !window.confirm(
      "Vous réduisez cette durée de " + previous + " à " + days + " jours. " +
      "Lors du prochain cycle de purge, des données pourront être supprimées " +
      "de façon irréversible. Confirmez-vous cette modification ?",
    )) return;

    setError("");
    setNotice("");
    setSavingKey(key);
    try {
      const response = await fetch("/api/admin/retention-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key, days, expectedDays: previous, confirmDecrease: isDecrease,
        }),
      });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { key: RetentionSettingKey; days: number };
      if (result.key !== key || result.days !== days) {
        throw new Error("Réponse de sauvegarde incohérente : vérifiez les paramètres.");
      }
      setSaved((current) => current ? { ...current, [key]: days } : current);
      setNotice(
        "Durée enregistrée : " + days + " jours. Aucune donnée n’a été supprimée. " +
        "La prochaine purge utilisera ce paramètre une fois SCRUM-57 déployée.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally { setSavingKey(null); }
  };

  const canCompare30d = saved !== null
    && saved.retentionArticlesDays >= 60
    && saved.retentionHashtagHourlyCountsDays >= 60;

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h2 mb-1">Conservation des données</h1>
          <p className="text-body-secondary mb-0">
            Réglage indépendant des onze durées de conservation, exprimées en jours.
          </p>
        </div>
        <Link href="/admin" className="btn btn-outline-secondary">Retour administration</Link>
      </div>
      <div className="alert alert-warning" role="note">
        <strong>Important :</strong> réduire une durée pourra provoquer une suppression irréversible
        lors d’un prochain cycle de purge. Augmenter une durée ne restaure jamais les données
        déjà effacées. <strong>L’enregistrement ne supprime aucune donnée :</strong> les purges
        automatiques seront développées dans SCRUM-57.
      </div>
      <p className="text-body-secondary small">
        Les sauvegardes et les logs externalisés sont gérés par l’infrastructure
        d’hébergement ; ils ne sont pas supprimés par ces réglages.
      </p>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2"
            onClick={() => window.location.reload()}>Recharger les paramètres</button>
        </div>
      )}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {loading && <p role="status">Chargement des durées de conservation…</p>}
      {saved && !canCompare30d && (
        <div className="alert alert-info" role="status">
          Une comparaison fiable des tendances sur 30 jours avec les 30 jours précédents
          exige au moins 60 jours de conservation pour les articles et les compteurs horaires.
          Le mode Tendances 30 jours restera indisponible si cette condition n’est pas remplie.
        </div>
      )}
      {saved && GROUPS.map((group) => (
        <section className="card shadow-sm mb-4" aria-label={group.heading} key={group.heading}>
          <div className="card-body p-4">
            <h2 className="h5 mb-1">{group.heading}</h2>
            <p className="text-body-secondary small mb-3">{group.hint}</p>
            <div className="row g-3">
              {group.fields.map((field) => {
                const value = draft[field.key] ?? "";
                const current = saved[field.key];
                const parsed = Number(value);
                const valid = /^\d+$/.test(value) && Number.isSafeInteger(parsed)
                  && parsed >= 1 && parsed <= RETENTION_MAX_DAYS;
                const changed = valid && parsed !== current;
                return (
                  <div key={field.key} className="col-12">
                    <form onSubmit={(event) => void save(event, field.key)}
                      className="row g-2 align-items-end border-bottom pb-3">
                      <div className="col-12 col-lg-7">
                        <label className="form-label fw-semibold mb-1" htmlFor={field.key}>
                          {field.label}
                        </label>
                        <div className="form-text mt-0">{field.note}</div>
                      </div>
                      <div className="col-7 col-sm-5 col-lg-2">
                        <div className="input-group">
                          <input type="number" id={field.key} className="form-control"
                            min="1" max={RETENTION_MAX_DAYS} step="1" required
                            aria-label={field.label + " (jours)"}
                            value={value}
                            disabled={savingKey !== null}
                            onChange={(event) => {
                              setDraft((previous) => ({
                                ...previous, [field.key]: event.target.value,
                              }));
                              setNotice("");
                            }} />
                          <span className="input-group-text">j</span>
                        </div>
                      </div>
                      <div className="col-5 col-sm-4 col-lg-3">
                        <button className="btn btn-primary w-100" type="submit"
                          disabled={!changed || savingKey !== null}>
                          {savingKey === field.key ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      </div>
                      {valid && parsed < current && (
                        <div className="col-12">
                          <span className="text-warning-emphasis small" role="status">
                            Attention : cette diminution pourra supprimer des données
                            irréversiblement lors de la prochaine purge.
                          </span>
                        </div>
                      )}
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
