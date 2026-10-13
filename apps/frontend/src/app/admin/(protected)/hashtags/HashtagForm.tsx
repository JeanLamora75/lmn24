"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
    setSaving(true);
    try {
      const response = await fetch(
        mode === "edit" ? "/api/admin/hashtags/" + encodeURIComponent(hashtagId) : "/api/admin/hashtags",
        { method: mode === "edit" ? "PUT" : "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) },
      );
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(await errorMessage(response));
      router.push("/admin/hashtags");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
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
        {mode === "edit" && <p className="form-text mt-3">
          {count} heure(s) de statistiques associées. Une modification des noms ou alias
          nécessitera une reconstruction des compteurs (prévue dans SCRUM-52).
        </p>}
        <p className="form-text mt-3">L&apos;illustration du hashtag (upload et import d&apos;image) sera ajoutée dans SCRUM-50.</p>
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
