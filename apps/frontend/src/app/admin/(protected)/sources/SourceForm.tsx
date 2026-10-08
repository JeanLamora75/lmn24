"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FRENCH_COUNTRY_OPTIONS } from "@/lib/fr-country-options";

import styles from "./source-form.module.css";

type SourceData = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl: string | null;
  countryIsoCode2: string;
  isActive: boolean;
};

type DeleteImpact = {
  feeds: number;
  articles: number;
};

type Props = Readonly<
  | {
      mode: "create";
      sourceId?: never;
    }
  | {
      mode: "edit";
      sourceId: string;
    }
>;

type FieldErrors = Partial<
  Record<
    "name" | "slug" | "websiteUrl" | "countryIsoCode2" | "image",
    string
  >
>;

const EMPTY_SOURCE: Omit<SourceData, "id"> = {
  name: "",
  slug: "",
  websiteUrl: "",
  logoUrl: null,
  countryIsoCode2: "",
  isActive: true,
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(" ");
    }

    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

export function SourceForm({ mode, sourceId }: Props) {
  const router = useRouter();

  const [values, setValues] = useState(EMPTY_SOURCE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pageError, setPageError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [loadingDeleteImpact, setLoadingDeleteImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localPreview = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !sourceId) {
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setPageError("");

      try {
        const response = await fetch(
          "/api/admin/sources/" + encodeURIComponent(sourceId),
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (!response.ok) {
          throw new Error("load-failed");
        }

        const source = (await response.json()) as SourceData;

        setValues({
          name: source.name,
          slug: source.slug,
          websiteUrl: source.websiteUrl,
          logoUrl: source.logoUrl,
          countryIsoCode2: source.countryIsoCode2,
          isActive: source.isActive,
        });
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setPageError(
            "Impossible de charger les informations de la source.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [mode, router, sourceId]);

  const imagePreview = localPreview ?? values.logoUrl;

  const showToast = (message: string, duration = 3000) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToastMessage(message);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  const updateValue = <K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!values.name.trim()) {
      errors.name = "Le nom du site est obligatoire.";
    }

    if (!values.slug.trim()) {
      errors.slug = "Le slug est obligatoire.";
    }

    if (!values.websiteUrl.trim()) {
      errors.websiteUrl = "L’URL du site est obligatoire.";
    } else if (!isValidHttpUrl(values.websiteUrl.trim())) {
      errors.websiteUrl = "Renseignez une URL HTTP ou HTTPS valide.";
    }

    if (!values.countryIsoCode2) {
      errors.countryIsoCode2 = "Le pays est obligatoire.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setFieldErrors((current) => ({
        ...current,
        image: "Utilisez une image PNG, JPEG ou WebP.",
      }));
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setFieldErrors((current) => {
      const next = { ...current };
      delete next.image;
      return next;
    });
    setSelectedFile(file);
  };

  const uploadSelectedImage = async (): Promise<string | null> => {
    if (!selectedFile) {
      return values.logoUrl;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/admin/sources/image", {
      method: "POST",
      body: formData,
    });

    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("unauthorized");
    }

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          "L’image n’a pas pu être enregistrée.",
        ),
      );
    }

    const payload = (await response.json()) as {
      logoUrl: string;
    };

    return payload.logoUrl;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving || !validate()) {
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const logoUrl = await uploadSelectedImage();

      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        websiteUrl: values.websiteUrl.trim(),
        countryIsoCode2: values.countryIsoCode2,
        isActive: values.isActive,
        logoUrl,
      };

      const endpoint =
        mode === "create"
          ? "/api/admin/sources"
          : "/api/admin/sources/" + encodeURIComponent(sourceId);

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "La source n’a pas pu être enregistrée.",
          ),
        );
      }

      router.push("/admin/sources");
      router.refresh();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !== "unauthorized"
      ) {
        setPageError(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const capture = async () => {
    if (capturing) {
      return;
    }

    const websiteUrl = values.websiteUrl.trim();

    if (!websiteUrl) {
      showToast("Renseigner l'url du site");
      return;
    }

    if (!isValidHttpUrl(websiteUrl)) {
      showToast("Renseignez une URL HTTP ou HTTPS valide.");
      return;
    }

    setCapturing(true);
    setPageError("");

    try {
      const response = await fetch("/api/admin/sources/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ websiteUrl }),
      });

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            "Le service de capture n’est pas disponible. Redémarrez le backend LMN24 puis réessayez.",
          );
        }

        throw new Error(
          await readErrorMessage(
            response,
            "La capture du site a échoué.",
          ),
        );
      }

      const payload = (await response.json()) as {
        logoUrl: string;
      };

      setSelectedFile(null);
      setValues((current) => ({
        ...current,
        logoUrl: payload.logoUrl,
      }));
    } catch (error) {
      if (error instanceof Error) {
        setPageError(error.message);
      }
    } finally {
      setCapturing(false);
    }
  };

  const openDeleteDialog = async () => {
    if (mode !== "edit" || loadingDeleteImpact) {
      return;
    }

    setLoadingDeleteImpact(true);
    setPageError("");

    try {
      const response = await fetch(
        "/api/admin/sources/" +
          encodeURIComponent(sourceId) +
          "/delete-impact",
        {
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Impossible de préparer la suppression.",
          ),
        );
      }

      setDeleteImpact((await response.json()) as DeleteImpact);
      setDeleteDialogOpen(true);
    } catch (error) {
      if (error instanceof Error) {
        setPageError(error.message);
      }
    } finally {
      setLoadingDeleteImpact(false);
    }
  };

  const confirmDelete = async () => {
    if (mode !== "edit" || deleting) {
      return;
    }

    setDeleting(true);
    setPageError("");

    try {
      const response = await fetch(
        "/api/admin/sources/" + encodeURIComponent(sourceId),
        {
          method: "DELETE",
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "La source n’a pas pu être supprimée.",
          ),
        );
      }

      router.push("/admin/sources");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setPageError(error.message);
      }
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="container py-5">
        <div className="text-center py-5">
          <span
            className="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Chargement…
        </div>
      </main>
    );
  }

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link href="/admin" className="btn btn-outline-secondary">
          Retour à l’administration
        </Link>
        <Link
          href="/admin/sources"
          className="btn btn-outline-secondary"
        >
          Retour aux sources
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="h2 mb-1">
          {mode === "create"
            ? "Ajouter une source"
            : "Modifier la source"}
        </h1>
        <p className="text-body-secondary mb-0">
          Renseignez les informations générales et l’image de la source.
        </p>
      </header>

      {pageError ? (
        <div className="alert alert-danger" role="alert">
          {pageError}
        </div>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="mb-3">
                  <label className="form-label" htmlFor="source-name">
                    Nom du site
                  </label>
                  <input
                    id="source-name"
                    className={
                      "form-control " +
                      (fieldErrors.name ? "is-invalid" : "")
                    }
                    value={values.name}
                    maxLength={255}
                    onChange={(event) =>
                      updateValue("name", event.target.value)
                    }
                  />
                  {fieldErrors.name ? (
                    <div className="invalid-feedback">
                      {fieldErrors.name}
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="source-slug">
                    Slug
                  </label>
                  <input
                    id="source-slug"
                    className={
                      "form-control " +
                      (fieldErrors.slug ? "is-invalid" : "")
                    }
                    value={values.slug}
                    maxLength={255}
                    onChange={(event) =>
                      updateValue("slug", event.target.value)
                    }
                  />
                  {fieldErrors.slug ? (
                    <div className="invalid-feedback">
                      {fieldErrors.slug}
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="source-website-url"
                  >
                    URL du site
                  </label>
                  <input
                    id="source-website-url"
                    type="url"
                    className={
                      "form-control " +
                      (fieldErrors.websiteUrl ? "is-invalid" : "")
                    }
                    value={values.websiteUrl}
                    onChange={(event) =>
                      updateValue("websiteUrl", event.target.value)
                    }
                  />
                  {fieldErrors.websiteUrl ? (
                    <div className="invalid-feedback">
                      {fieldErrors.websiteUrl}
                    </div>
                  ) : null}
                </div>

                <div className="mb-4">
                  <label
                    className="form-label"
                    htmlFor="source-country"
                  >
                    Pays
                  </label>
                  <select
                    id="source-country"
                    className={
                      "form-select " +
                      (fieldErrors.countryIsoCode2 ? "is-invalid" : "")
                    }
                    value={values.countryIsoCode2}
                    onChange={(event) =>
                      updateValue("countryIsoCode2", event.target.value)
                    }
                  >
                    <option value="">Sélectionner un pays</option>
                    {FRENCH_COUNTRY_OPTIONS.map((country) => (
                      <option value={country.isoCode2} key={country.isoCode2}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.countryIsoCode2 ? (
                    <div className="invalid-feedback">
                      {fieldErrors.countryIsoCode2}
                    </div>
                  ) : null}
                </div>

                <div className="form-check form-switch">
                  <input
                    id="source-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={values.isActive}
                    onChange={(event) =>
                      updateValue("isActive", event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor="source-active"
                  >
                    Source active
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Image du site</h2>

                {imagePreview ? (
                  <div
                    className={styles.imagePreview}
                    style={{
                      backgroundImage:
                        "url(" + JSON.stringify(imagePreview) + ")",
                    }}
                    role="img"
                    aria-label="Aperçu de l’image de la source"
                  />
                ) : (
                  <div className={styles.noImage}>No Img</div>
                )}

                <div className="mt-3">
                  <label
                    className="form-label"
                    htmlFor="source-image-file"
                  >
                    Pièce jointe
                  </label>
                  <input
                    id="source-image-file"
                    type="file"
                    className={
                      "form-control " +
                      (fieldErrors.image ? "is-invalid" : "")
                    }
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                  />
                  {fieldErrors.image ? (
                    <div className="invalid-feedback">
                      {fieldErrors.image}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="btn btn-outline-primary w-100 mt-3"
                  disabled={capturing}
                  onClick={() => void capture()}
                >
                  {capturing ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      />
                      Capture en cours…
                    </>
                  ) : (
                    "Capturer"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2 mt-4">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || capturing || deleting}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>

          <Link
            href="/admin/sources"
            className="btn btn-outline-secondary"
            aria-disabled={saving || deleting}
          >
            Annuler
          </Link>

          {mode === "edit" ? (
            <button
              type="button"
              className="btn btn-outline-danger ms-sm-auto"
              disabled={
                saving ||
                capturing ||
                deleting ||
                loadingDeleteImpact
              }
              onClick={() => void openDeleteDialog()}
            >
              {loadingDeleteImpact
                ? "Préparation…"
                : "Supprimer"}
            </button>
          ) : null}
        </div>
      </form>

      {toastMessage ? (
        <div
          className={
            "toast show border border-warning shadow-lg " + styles.toast
          }
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="toast-body text-center fw-semibold py-3">
            {toastMessage}
          </div>
        </div>
      ) : null}

      {deleteDialogOpen && deleteImpact ? (
        <>
          <div
            className="modal d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-source-title"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2
                    className="modal-title fs-5"
                    id="delete-source-title"
                  >
                    Confirmer la suppression
                  </h2>
                </div>

                <div className="modal-body">
                  <p className="mb-0">
                    Cette source possède{" "}
                    <strong>{deleteImpact.feeds}</strong> flux RSS/XML
                    et{" "}
                    <strong>{deleteImpact.articles}</strong> articles.
                    La suppression de la source supprimera également ces
                    données.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={deleting}
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                  >
                    {deleting ? "Suppression…" : "Confirmer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </main>
  );
}
