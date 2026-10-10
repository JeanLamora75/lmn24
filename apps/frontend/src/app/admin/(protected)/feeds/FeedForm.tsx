"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";
import { resolveInitialFeedSourceId } from "@/lib/feed-source-prefill";

type SourceOption = {
  id: string;
  name: string;
  websiteUrl: string;
};

type CategoryOption = {
  id: string;
  slug: string;
};

type LanguageOption = {
  isoCode2: string;
};

type FormOptions = {
  sources: SourceOption[];
  categories: CategoryOption[];
  languages: LanguageOption[];
};

type FeedData = {
  id: string;
  sourceId: string;
  categoryId: string;
  languageIsoCode2: string;
  feedUrl: string;
  isActive: boolean;
};

type DeleteImpact = {
  feedRuns: number;
};

type Props = Readonly<
  | {
      mode: "create";
      feedId?: never;
      initialSourceId?: string;
    }
  | {
      mode: "edit";
      feedId: string;
      initialSourceId?: never;
    }
>;

type FieldErrors = Partial<
  Record<
    "sourceId" | "categoryId" | "languageIsoCode2" | "feedUrl",
    string
  >
>;

const EMPTY_FEED: Omit<FeedData, "id"> = {
  sourceId: "",
  categoryId: "",
  languageIsoCode2: "",
  feedUrl: "",
  isActive: true,
};

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
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

export function FeedForm({ mode, feedId, initialSourceId }: Props) {
  const router = useRouter();

  const [values, setValues] = useState(EMPTY_FEED);
  const [options, setOptions] = useState<FormOptions>({
    sources: [],
    categories: [],
    languages: [],
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pageError, setPageError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDeleteImpact, setLoadingDeleteImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setPageError("");

      try {
        const requests: Promise<Response>[] = [
          fetch("/api/admin/feeds/form-options", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ];

        if (mode === "edit" && feedId) {
          requests.push(
            fetch("/api/admin/feeds/" + encodeURIComponent(feedId), {
              cache: "no-store",
              signal: controller.signal,
            }),
          );
        }

        const responses = await Promise.all(requests);
        const unauthorized = responses.some(
          (response) => response.status === 401,
        );

        if (unauthorized) {
          router.replace("/admin/login");
          return;
        }

        if (responses.some((response) => !response.ok)) {
          throw new Error("load-failed");
        }

        const formOptions = (await responses[0]!.json()) as FormOptions;
        setOptions(formOptions);

        if (mode === "edit") {
          const feed = (await responses[1]!.json()) as FeedData;

          setValues({
            sourceId: feed.sourceId,
            categoryId: feed.categoryId,
            languageIsoCode2: feed.languageIsoCode2
              .trim()
              .toLowerCase(),
            feedUrl: feed.feedUrl,
            isActive: feed.isActive,
          });
        } else {
          // La source est validée contre les options réellement disponibles :
          // aucun nom ni identifiant ne sont déduits de l'URL.
          const preselectedId = resolveInitialFeedSourceId(
            initialSourceId,
            formOptions.sources,
          );
          setValues({ ...EMPTY_FEED, sourceId: preselectedId });
          if (initialSourceId && !preselectedId) {
            setPageError(
              "La source demandée est introuvable. Sélectionnez une source disponible.",
            );
          }
        }
      } catch (caught) {
        if (
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setPageError(
            "Impossible de charger les informations du flux RSS/XML.",
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
  }, [feedId, initialSourceId, mode, router]);

  const sortedCategories = useMemo(
    () =>
      [...options.categories].sort((a, b) =>
        getFrenchCategoryLabel(a.slug).localeCompare(
          getFrenchCategoryLabel(b.slug),
          "fr",
          { sensitivity: "base" },
        ),
      ),
    [options.categories],
  );

  const selectedSource = useMemo(
    () =>
      options.sources.find((source) => source.id === values.sourceId) ??
      null,
    [options.sources, values.sourceId],
  );

  const sourceWebsiteUrl = selectedSource
    ? safeHttpUrl(selectedSource.websiteUrl)
    : null;
  const feedPreviewUrl = safeHttpUrl(values.feedUrl);

  const updateValue = <K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key as keyof FieldErrors];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!values.sourceId) {
      errors.sourceId = "La source du flux est obligatoire.";
    }

    if (!values.categoryId) {
      errors.categoryId = "La catégorie est obligatoire.";
    }

    if (!values.languageIsoCode2) {
      errors.languageIsoCode2 = "La langue est obligatoire.";
    }

    if (!values.feedUrl.trim()) {
      errors.feedUrl = "L’URL du flux RSS/XML est obligatoire.";
    } else if (!safeHttpUrl(values.feedUrl)) {
      errors.feedUrl = "Renseignez une URL HTTP ou HTTPS valide.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving || deleting || !validate()) {
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/feeds"
          : "/api/admin/feeds/" + encodeURIComponent(feedId);

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceId: values.sourceId,
          categoryId: values.categoryId,
          languageIsoCode2: values.languageIsoCode2,
          feedUrl: values.feedUrl.trim(),
          isActive: values.isActive,
        }),
      });

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Le flux RSS/XML n’a pas pu être enregistré.",
          ),
        );
      }

      router.push("/admin/feeds");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setPageError(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = async () => {
    if (
      mode !== "edit" ||
      !feedId ||
      loadingDeleteImpact ||
      deleting
    ) {
      return;
    }

    setLoadingDeleteImpact(true);
    setPageError("");

    try {
      const response = await fetch(
        "/api/admin/feeds/" +
          encodeURIComponent(feedId) +
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
            "Impossible de préparer la suppression du flux.",
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
    if (mode !== "edit" || !feedId || deleting) {
      return;
    }

    setDeleting(true);
    setPageError("");

    try {
      const response = await fetch(
        "/api/admin/feeds/" + encodeURIComponent(feedId),
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
            "Le flux RSS/XML n’a pas pu être supprimé.",
          ),
        );
      }

      router.push("/admin/feeds");
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
          href="/admin/feeds"
          className="btn btn-outline-secondary"
        >
          Retour aux flux RSS/XML
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="h2 mb-1">
          {mode === "create"
            ? "Ajouter un flux RSS/XML"
            : "Modifier le flux RSS/XML"}
        </h1>
        <p className="text-body-secondary mb-0">
          Renseignez la source, la catégorie, la langue et l’URL du flux.
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
                  <label className="form-label" htmlFor="feed-source">
                    Source du flux
                  </label>
                  <select
                    id="feed-source"
                    className={
                      "form-select " +
                      (fieldErrors.sourceId ? "is-invalid" : "")
                    }
                    value={values.sourceId}
                    onChange={(event) =>
                      updateValue("sourceId", event.target.value)
                    }
                  >
                    <option value="">Sélectionner une source</option>
                    {options.sources.map((source) => (
                      <option value={source.id} key={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.sourceId ? (
                    <div className="invalid-feedback">
                      {fieldErrors.sourceId}
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="feed-category">
                    Catégorie
                  </label>
                  <select
                    id="feed-category"
                    className={
                      "form-select " +
                      (fieldErrors.categoryId ? "is-invalid" : "")
                    }
                    value={values.categoryId}
                    onChange={(event) =>
                      updateValue("categoryId", event.target.value)
                    }
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {sortedCategories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {getFrenchCategoryLabel(category.slug)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.categoryId ? (
                    <div className="invalid-feedback">
                      {fieldErrors.categoryId}
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="feed-language">
                    Langue du flux
                  </label>
                  <select
                    id="feed-language"
                    className={
                      "form-select " +
                      (fieldErrors.languageIsoCode2 ? "is-invalid" : "")
                    }
                    value={values.languageIsoCode2}
                    onChange={(event) =>
                      updateValue(
                        "languageIsoCode2",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Sélectionner une langue</option>
                    {options.languages.map((language) => {
                      const code = language.isoCode2
                        .trim()
                        .toLowerCase();

                      return (
                        <option value={code} key={code}>
                          {code.toUpperCase()}
                        </option>
                      );
                    })}
                  </select>
                  {fieldErrors.languageIsoCode2 ? (
                    <div className="invalid-feedback">
                      {fieldErrors.languageIsoCode2}
                    </div>
                  ) : null}
                </div>

                <div className="mb-4">
                  <label className="form-label" htmlFor="feed-url">
                    URL du flux RSS/XML
                  </label>
                  <input
                    id="feed-url"
                    type="url"
                    className={
                      "form-control " +
                      (fieldErrors.feedUrl ? "is-invalid" : "")
                    }
                    value={values.feedUrl}
                    onChange={(event) =>
                      updateValue("feedUrl", event.target.value)
                    }
                    placeholder="https://example.com/rss.xml"
                  />
                  {fieldErrors.feedUrl ? (
                    <div className="invalid-feedback">
                      {fieldErrors.feedUrl}
                    </div>
                  ) : null}
                </div>

                <div className="form-check form-switch">
                  <input
                    id="feed-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={values.isActive}
                    onChange={(event) =>
                      updateValue("isActive", event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor="feed-active"
                  >
                    Flux actif
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Consultation</h2>

                <div className="d-grid gap-3">
                  {sourceWebsiteUrl ? (
                    <a
                      href={sourceWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary"
                    >
                      Consulter le site
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      disabled
                    >
                      Consulter le site
                    </button>
                  )}

                  {feedPreviewUrl ? (
                    <a
                      href={feedPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary"
                    >
                      Voir le flux
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      disabled
                    >
                      Voir le flux
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2 mt-4">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || deleting || loadingDeleteImpact}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>

          <Link
            href="/admin/feeds"
            className="btn btn-outline-secondary"
            aria-disabled={saving || deleting}
          >
            Annuler
          </Link>

          {mode === "edit" ? (
            <button
              type="button"
              className="btn btn-outline-danger ms-sm-auto"
              disabled={saving || deleting || loadingDeleteImpact}
              onClick={() => void openDeleteDialog()}
            >
              {loadingDeleteImpact
                ? "Préparation…"
                : "Supprimer"}
            </button>
          ) : null}
        </div>
      </form>

      {deleteDialogOpen && deleteImpact ? (
        <>
          <div
            className="modal d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-feed-title"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2
                    className="modal-title fs-5"
                    id="delete-feed-title"
                  >
                    Supprimer ce flux RSS/XML ?
                  </h2>
                </div>

                <div className="modal-body">
                  <p className="mb-0">
                    Cette opération supprimera également{" "}
                    <strong>{deleteImpact.feedRuns}</strong>{" "}
                    historique
                    {deleteImpact.feedRuns > 1 ? "s" : ""} d’exécution
                    {" "}(FeedRun) associé
                    {deleteImpact.feedRuns > 1 ? "s" : ""} à ce flux.
                    Les articles existants seront conservés. Cette action
                    est irréversible.
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
