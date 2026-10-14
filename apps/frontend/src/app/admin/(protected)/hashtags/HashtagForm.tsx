"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type AliasInput = { name: string; languageIsoCode2: string };
type Values = {
  name: string; slug: string; isActive: boolean; aliases: AliasInput[];
};
type HashtagFromApi = {
  id: string; imageUrl: string | null;
  name: string; slug: string; isActive: boolean;
  aliases: Array<{ name: string; languageIsoCode2: string | null }>;
  hourlyCountRows: number;
};
type Props = Readonly<
  | { mode: "create"; hashtagId?: never }
  | { mode: "edit"; hashtagId: string }
>;

const EMPTY: Values = { name: "", slug: "", isActive: true, aliases: [] };
function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
async function errorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string | string[] };
    return Array.isArray(data.message) ? data.message.join(" ") : data.message || "Enregistrement impossible.";
  } catch { return "Enregistrement impossible."; }
}

export function HashtagForm({ mode, hashtagId }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaMode, setMediaMode] = useState<"file" | "url">("file");
  const [remoteImageUrl, setRemoteImageUrl] = useState("");
  const [removingImage, setRemovingImage] = useState(false);
  const [notice, setNotice] = useState("");
  const currentId = hashtagId ?? createdId;
  const cancelScan = useRef(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [rebuildRequested, setRebuildRequested] = useState(false);
  const [rebuildNotice, setRebuildNotice] = useState("");
  const [scanResult, setScanResult] = useState<{
    scanned: number; matched: number; complete: boolean;
  } | null>(null);

  useEffect(() => {
    if (mode !== "edit") return;
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/hashtags/" + encodeURIComponent(hashtagId), {
          cache: "no-store", signal: abort.signal,
        });
        if (response.status === 401) { router.replace("/admin/login"); return; }
        if (!response.ok) throw new Error("Hashtag introuvable ou accès interdit.");
        const item = await response.json() as HashtagFromApi;
        if (!abort.signal.aborted) {
          setValues({
            name: item.name, slug: item.slug, isActive: item.isActive,
            aliases: item.aliases.map((a) => ({
              name: a.name, languageIsoCode2: a.languageIsoCode2 ?? "",
            })),
          });
          setCount(item.hourlyCountRows);
          setImageUrl(item.imageUrl);
          setSlugEdited(true);
        }
      } catch (e) {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [mode, hashtagId, router]);

  const payload = () => ({
    name: values.name.trim(),
    slug: values.slug.trim(),
    isActive: values.isActive,
    aliases: values.aliases.map((a) => ({
      name: a.name.trim(),
      languageIsoCode2: a.languageIsoCode2.trim().toLowerCase() || null,
    })),
  });

  const checkWarnings = async () => {
    setError("");
    const response = await fetch("/api/admin/hashtags/warnings", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ hashtag: payload(), ...(hashtagId ? { exceptId: hashtagId } : {}) }),
    });
    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }
    const result = await response.json() as { warnings: string[] };
    setWarnings(result.warnings);
  };


  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mediaMode === "url" && remoteImageUrl.trim()) {
      try {
        const parsed = new URL(remoteImageUrl.trim());
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
          throw new Error("Lien non HTTPS.");
        }
      } catch {
        setError("Utilisez un lien public HTTPS vers une image JPEG, PNG ou WebP.");
        return;
      }
    }
    setSaving(true);
    let persisted = false;
    try {
      const id = currentId;
      const response = await fetch(
        id ? "/api/admin/hashtags/" + encodeURIComponent(id) : "/api/admin/hashtags",
        {
          method: id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await errorMessage(response));
      const saved = await response.json() as HashtagFromApi;
      setCreatedId(saved.id);
      persisted = true;
      const url = "/api/admin/hashtags/" + encodeURIComponent(saved.id) + "/image";
      if (mediaMode === "file" && selectedFile) {
        const form = new FormData();
        form.append("file", selectedFile);
        const imgResponse = await fetch(url, { method: "POST", body: form });
        if (!imgResponse.ok) throw new Error(await errorMessage(imgResponse));
        const result = await imgResponse.json() as HashtagFromApi;
        setImageUrl(result.imageUrl);
      } else if (mediaMode === "url" && remoteImageUrl.trim()) {
        const imgResponse = await fetch(url + "/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: remoteImageUrl.trim() }),
        });
        if (!imgResponse.ok) throw new Error(await errorMessage(imgResponse));
        const result = await imgResponse.json() as HashtagFromApi;
        setImageUrl(result.imageUrl);
      }
      setSelectedFile(null);
      setRemoteImageUrl("");
      router.push("/admin/hashtags");
      router.refresh();
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Enregistrement impossible.";
      setError(persisted
        ? "Hashtag enregistré, mais image non importée : " + reason +
          " Vous pouvez corriger l'image et réessayer sans recréer le hashtag."
        : reason);
    } finally { setSaving(false); }
  };

  const removeImage = async () => {
    if (!currentId || !imageUrl || !window.confirm("Supprimer l’image du hashtag ?")) return;
    setRemovingImage(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/hashtags/" + encodeURIComponent(currentId) + "/image", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setImageUrl(null);
      setSelectedFile(null);
      setRemoteImageUrl("");
      setNotice("Image supprimée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression de l’image impossible.");
    } finally { setRemovingImage(false); }
  };

  const rebuildHourly = async () => {
    if (!currentId || rebuildRequested) return;
    setRebuildRequested(true);
    setError("");
    setRebuildNotice("");
    try {
      const response = await fetch(
        "/api/admin/hashtags/" + encodeURIComponent(currentId) + "/rebuild",
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      setRebuildNotice(
        "Reconstruction demandée. Les compteurs seront remplacés après son exécution ; " +
        "le classement n'affichera pas de résultat partiel.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reconstruction impossible.");
    } finally { setRebuildRequested(false); }
  };

  const analyzeHistory = async () => {
    if (!currentId) return;
    cancelScan.current = false;
    setScanRunning(true);
    setScanResult({ scanned: 0, matched: 0, complete: false });
    setError("");
    try {
      let cursor: string | null = null;
      let asOf: string | undefined;
      let version: string | undefined;
      let scanned = 0;
      let matched = 0;
      do {
        if (cancelScan.current) break;
        const response = await fetch(
          "/api/admin/hashtags/" + encodeURIComponent(currentId) + "/analyze",
          { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...(cursor ? { cursor } : {}),
              ...(asOf ? { asOf } : {}),
              ...(version ? { version } : {}),
            }) },
        );
        if (response.status === 401) { router.replace("/admin/login"); return; }
        if (!response.ok) throw new Error(await errorMessage(response));
        const batch = await response.json() as {
          asOf: string; definitionVersion: string;
          scannedArticles: number; matchingArticles: number; nextCursor: string | null;
        };
        asOf = batch.asOf;
        version = batch.definitionVersion;
        cursor = batch.nextCursor;
        scanned += batch.scannedArticles;
        matched += batch.matchingArticles;
        setScanResult({ scanned, matched, complete: !cursor });
      } while (cursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analyse historique impossible.");
    } finally {
      setScanRunning(false);
    }
  };

  if (loading) return <main className="container py-4"><p>Chargement du hashtag…</p></main>;

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-4">
        <h1 className="h2 mb-0">{mode === "create" ? "Ajouter un hashtag" : "Modifier un hashtag"}</h1>
        <Link className="btn btn-outline-secondary" href="/admin/hashtags">Retour aux hashtags</Link>
      </div>
      <form className="card shadow-sm p-4" onSubmit={(event) => void save(event)}>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        {notice && <div role="status" className="alert alert-success">{notice}</div>}
        <div className="row g-3">
          <div className="col-md-7">
            <label className="form-label" htmlFor="hashtagName">Nom du hashtag *</label>
            <input required maxLength={255} id="hashtagName" className="form-control"
              value={values.name} onChange={(e) => {
                const name = e.target.value;
                setValues((v) => ({ ...v, name, slug: slugEdited ? v.slug : slugify(name) }));
              }} />
          </div>
          <div className="col-md-5">
            <label className="form-label" htmlFor="hashtagSlug">Slug URL *</label>
            <input required id="hashtagSlug" className="form-control" maxLength={255}
              pattern="[a-z0-9]+(-[a-z0-9]+)*" value={values.slug}
              onChange={(e) => { setSlugEdited(true); setValues((v) => ({ ...v, slug: e.target.value })); }} />
            <div className="form-text">Minuscules, chiffres et tirets. Pour un nom non latin, renseigner le slug manuellement.</div>
          </div>
          <div className="col-12">
            <div className="form-check form-switch">
              <input type="checkbox" className="form-check-input" id="hashtagActive" checked={values.isActive}
                onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} />
              <label htmlFor="hashtagActive" className="form-check-label">Hashtag actif (visible sur le site public)</label>
            </div>
          </div>
        </div>
        <hr />
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
          <h2 className="h5 mb-0">Alias et variantes linguistiques</h2>
          <button type="button" className="btn btn-sm btn-outline-primary"
            onClick={() => setValues((v) => ({
              ...v, aliases: [...v.aliases, { name: "", languageIsoCode2: "" }],
            }))}>Ajouter un alias</button>
        </div>
        <p className="text-body-secondary small">Ex. Moscou, Moscow, Москва. La langue est facultative et les mentions seront recherchées dans tous les articles.</p>
        {values.aliases.map((a, i) => (
          <div className="row g-2 mb-2 align-items-end" key={i}>
            <div className="col-md-7">
              <label htmlFor={"alias-" + i} className="form-label small">Alias {i + 1}</label>
              <input required maxLength={255} id={"alias-" + i} className="form-control"
                value={a.name} onChange={(e) => setValues((v) => ({
                  ...v, aliases: v.aliases.map((x, j) => j === i ? { ...x, name: e.target.value } : x),
                }))} />
            </div>
            <div className="col-md-3">
              <label htmlFor={"lang-" + i} className="form-label small">Langue ISO (facultative)</label>
              <input placeholder="fr / en / ru" pattern="[a-zA-Z]{2}" maxLength={2} id={"lang-" + i}
                className="form-control" value={a.languageIsoCode2}
                onChange={(e) => setValues((v) => ({
                  ...v, aliases: v.aliases.map((x, j) => j === i ? {
                    ...x, languageIsoCode2: e.target.value,
                  } : x),
                }))} />
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-outline-danger w-100"
                onClick={() => setValues((v) => ({
                  ...v, aliases: v.aliases.filter((_, j) => j !== i),
                }))}>Retirer</button>
            </div>
          </div>
        ))}
        {warnings.length > 0 && <div className="alert alert-warning" role="status">
          {warnings.map((message) => <p className="mb-1" key={message}>{message}</p>)}
        </div>}
        <button type="button" className="btn btn-sm btn-outline-info align-self-start mt-2"
          onClick={() => void checkWarnings()}>Analyser les risques d&apos;homonymes</button>
        {mode === "edit" && (
          <section className="border rounded p-3 mt-3" aria-label="Analyse des articles existants">
            <h2 className="h6">Analyser les articles déjà enregistrés</h2>
            <p className="small text-body-secondary">
              Recherche le nom et les alias dans les titres et descriptions de tous les articles
              conservés, quelle que soit leur langue. Analyse progressive par lots de 500,
              sans création de liens article-hashtag en base.
            </p>
            <button type="button" className="btn btn-outline-primary btn-sm"
              disabled={scanRunning} onClick={() => void analyzeHistory()}>
              {scanRunning ? "Analyse en cours…" : "Analyser les articles conservés"}
            </button>
            {scanRunning && (
              <button type="button" className="btn btn-outline-secondary btn-sm ms-2"
                onClick={() => { cancelScan.current = true; }}>Arrêter</button>
            )}
            {scanResult && (
              <p className="mt-2 mb-1 small" role="status">
                {scanResult.scanned.toLocaleString("fr-FR")} articles examinés —
                {" "}{scanResult.matched.toLocaleString("fr-FR")} mentionnant ce hashtag.
                {scanResult.complete ? " Analyse terminée." : " Résultat provisoire."}
              </p>
            )}
            <div className="mt-3">
              <button type="button" className="btn btn-sm btn-outline-success"
                disabled={rebuildRequested} onClick={() => void rebuildHourly()}>
                {rebuildRequested ? "Demande en cours…" : "Reconstruire les compteurs horaires"}
              </button>
              {rebuildNotice && <p className="form-text" role="status">{rebuildNotice}</p>}
            </div>
            <p className="form-text mb-0">
              Ceci est un diagnostic. L&apos;enregistrement des statistiques horaires
              et leur reconstruction sont maintenant assurés par SCRUM-52.
            </p>
          </section>
        )}
        {mode === "edit" && <p className="form-text mt-3">
          {count} heure(s) de statistiques associées. Une modification des noms ou alias
          entraîne une reconstruction automatique des compteurs.
        </p>}

        <hr />
        <h2 className="h5 mb-3">Image du hashtag</h2>
        <div className="row g-3">
          <div className="col-md-4">
            {imageUrl ? (
              <Image src={imageUrl} alt={"Illustration de " + values.name}
                width={320} height={180} unoptimized className="img-fluid rounded border" />
            ) : (
              <div className="bg-body-tertiary border rounded d-flex align-items-center justify-content-center text-body-secondary"
                style={{ aspectRatio: "16/9" }}>Aucune image</div>
            )}
            {imageUrl && (
              <button type="button" className="btn btn-sm btn-outline-danger mt-2"
                disabled={removingImage || saving} onClick={() => void removeImage()}>
                {removingImage ? "Suppression…" : "Supprimer l’image"}
              </button>
            )}
          </div>
          <div className="col-md-8">
            <fieldset>
              <legend className="fs-6">Source de l’image</legend>
              <div className="d-flex flex-wrap gap-3 mb-3">
                <label className="form-check-label">
                  <input type="radio" className="form-check-input me-2" name="imageSource"
                    checked={mediaMode === "file"} onChange={() => setMediaMode("file")} />
                  Fichier local
                </label>
                <label className="form-check-label">
                  <input type="radio" className="form-check-input me-2" name="imageSource"
                    checked={mediaMode === "url"} onChange={() => setMediaMode("url")} />
                  Importer depuis une URL
                </label>
              </div>
            </fieldset>
            {mediaMode === "file" ? (
              <div>
                <label className="form-label" htmlFor="hashtag-image-file">Choisir une image</label>
                <input id="hashtag-image-file" className="form-control" type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                {selectedFile && <div className="form-text">Fichier choisi : {selectedFile.name}</div>}
              </div>
            ) : (
              <div>
                <label htmlFor="hashtag-image-url" className="form-label">URL HTTPS de l’image</label>
                <input type="url" id="hashtag-image-url" className="form-control"
                  value={remoteImageUrl} placeholder="https://example.org/photo.jpg"
                  onChange={(e) => setRemoteImageUrl(e.target.value)} />
                <p className="form-text">
                  Collez l’URL HTTPS directe d’une image JPEG, PNG ou WebP,
                  ou le lien vers la page d’un fichier Wikimedia Commons.
                  Les pages de résultats Google Images et les pages web ordinaires
                  ne sont pas des liens directs vers une image.
                  L’image sera téléchargée et enregistrée en WebP sur LMN24.
                </p>
              </div>
            )}
            <p className="form-text mb-2">JPEG, PNG ou WebP, maximum 8 Mo. Conversion et optimisation WebP automatiques.</p>
            <div className="d-flex flex-wrap gap-2">
              <a className="btn btn-sm btn-outline-primary" target="_blank" rel="noopener noreferrer"
                href={"https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(values.name)}>
                Rechercher sur Google Images ↗
              </a>
              <a className="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener noreferrer"
                href={"https://commons.wikimedia.org/w/index.php?search=" + encodeURIComponent(values.name) +
                  "&title=Special:MediaSearch&type=image"}>
                Rechercher sur Wikimedia Commons ↗
              </a>
            </div>
            <p className="form-text mt-2">
              Vérifiez les droits de réutilisation et les crédits avant l’import.
              Ces boutons ne téléchargent aucune image automatiquement.
            </p>
          </div>
        </div>
        <div className="d-flex gap-2 justify-content-end mt-3">
          <Link className="btn btn-outline-secondary" href="/admin/hashtags">Annuler</Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </main>
  );
}
