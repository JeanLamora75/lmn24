"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { CategoryHomeLayout } from "@lmn24/contracts";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";

import {
  CATEGORY_APPEARANCE_OPTIONS,
  DEFAULT_CATEGORY_APPEARANCE,
  isCategoryHomeLayout,
  normalizeThemeColor,
  validateCategoryAppearance,
  type CategoryAppearance,
} from "./category-appearance";
import { CategoryAppearancePreview } from "./CategoryAppearancePreview";
import styles from "./category-appearance.module.css";

type CategoryData = {
  id: string;
  slug: string;
  isActive: boolean;
  displayOrder: number;
  layoutType: CategoryHomeLayout;
  themeColor: string;
};

type FieldErrors = {
  layoutType?: string;
  themeColor?: string;
};

type Props = {
  categoryId: string;
};

export function CategoryAppearanceForm({ categoryId }: Props) {
  const router = useRouter();
  const savingRef = useRef(false);
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [layoutType, setLayoutType] = useState<string>(
    DEFAULT_CATEGORY_APPEARANCE.layoutType,
  );
  const [themeColor, setThemeColor] = useState(
    DEFAULT_CATEGORY_APPEARANCE.themeColor,
  );
  const [lastSaved, setLastSaved] = useState<CategoryAppearance | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategory() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(
          "/api/admin/categories/" + encodeURIComponent(categoryId),
          { cache: "no-store", signal: controller.signal },
        );

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (response.status === 404) {
          setLoadError("Cette catégorie n’existe pas ou n’est plus disponible.");
          return;
        }
        if (!response.ok) {
          throw new Error("load-failed");
        }

        const data = (await response.json()) as CategoryData;
        if (
          !data ||
          data.id !== categoryId ||
          typeof data.slug !== "string" ||
          typeof data.isActive !== "boolean"
        ) {
          throw new Error("invalid-response");
        }

        const validLayout = isCategoryHomeLayout(data.layoutType)
          ? data.layoutType
          : DEFAULT_CATEGORY_APPEARANCE.layoutType;
        const validColor =
          normalizeThemeColor(data.themeColor ?? "") ??
          DEFAULT_CATEGORY_APPEARANCE.themeColor;

        setCategory(data);
        setLayoutType(validLayout);
        setThemeColor(validColor);
        setLastSaved({ layoutType: validLayout, themeColor: validColor });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setLoadError("Impossible de charger la catégorie. Réessayez en actualisant la page.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCategory();
    return () => controller.abort();
  }, [categoryId, router]);

  function updateLayout(next: string) {
    setLayoutType(next);
    setSuccess("");
    setSaveError("");
    setFieldErrors((errors) => ({ ...errors, layoutType: undefined }));
  }

  function updateColor(next: string) {
    setThemeColor(next);
    setSuccess("");
    setSaveError("");
    setFieldErrors((errors) => ({ ...errors, themeColor: undefined }));
  }

  function resetDefaults() {
    if (saving) return;
    updateLayout(DEFAULT_CATEGORY_APPEARANCE.layoutType);
    updateColor(DEFAULT_CATEGORY_APPEARANCE.themeColor);
    setFieldErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || saving || !category) return;

    const validation = validateCategoryAppearance({ layoutType, themeColor });
    setFieldErrors(validation.errors);
    setSuccess("");
    setSaveError("");

    if (!validation.value) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const response = await fetch(
        "/api/admin/categories/" +
          encodeURIComponent(categoryId) +
          "/home-display",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(validation.value),
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (response.status === 404) {
        setSaveError("Cette catégorie n’existe plus. Retournez à la liste.");
        return;
      }
      if (!response.ok) {
        throw new Error("save-failed");
      }

      const saved = (await response.json()) as CategoryData;
      const savedValidation = validateCategoryAppearance({
        layoutType: saved.layoutType,
        themeColor: saved.themeColor,
      });

      if (!savedValidation.value || saved.id !== categoryId) {
        throw new Error("invalid-save-response");
      }

      setLayoutType(savedValidation.value.layoutType);
      setThemeColor(savedValidation.value.themeColor);
      setLastSaved(savedValidation.value);
      setSuccess("La mise en page et la couleur ont été enregistrées.");
      router.refresh();
    } catch {
      setSaveError(
        "L’enregistrement a échoué. Vos valeurs ont été conservées dans le formulaire, mais elles ne sont pas confirmées en base.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="container py-5" aria-live="polite">
        <div className="text-center py-5">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Chargement de la catégorie…
        </div>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="container py-5">
        <Link href="/admin/categories" className="btn btn-outline-secondary mb-4">
          ← Retour aux catégories
        </Link>
        <div role="alert" className="alert alert-danger">
          {loadError || "Catégorie introuvable."}
        </div>
      </main>
    );
  }

  const categoryLabel = getFrenchCategoryLabel(category.slug);
  const selectedOption = CATEGORY_APPEARANCE_OPTIONS.find(
    (option) => option.layoutType === layoutType,
  );

  const previewLayout = isCategoryHomeLayout(layoutType)
    ? layoutType
    : DEFAULT_CATEGORY_APPEARANCE.layoutType;
  const previewColor =
    normalizeThemeColor(themeColor) ??
    lastSaved?.themeColor ??
    DEFAULT_CATEGORY_APPEARANCE.themeColor;

  const savedColor = normalizeThemeColor(themeColor);
  const unchanged =
    lastSaved?.layoutType === layoutType &&
    lastSaved?.themeColor === savedColor;

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <div className="d-flex gap-2 flex-wrap mb-4">
        <Link href="/admin" className="btn btn-outline-secondary">
          Retour à l’administration
        </Link>
        <Link href="/admin/categories" className="btn btn-outline-secondary">
          Retour aux catégories
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="h2 mb-1">Configurer une catégorie</h1>
        <p className="text-body-secondary mb-0">
          Personnalisez uniquement son apparence sur la page d’accueil.
        </p>
      </header>

      {loadError && (
        <div className="alert alert-danger" role="alert">{loadError}</div>
      )}
      {saveError && (
        <div className="alert alert-danger" role="alert">{saveError}</div>
      )}
      {success && (
        <div className="alert alert-success" role="status">{success}</div>
      )}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3 p-md-4 d-flex flex-wrap gap-3 justify-content-between align-items-center">
          <div>
            <p className="text-body-secondary small mb-1">Catégorie</p>
            <p className="h4 mb-0">{categoryLabel}</p>
            <p className="small text-body-secondary mb-0">
              Identifiant : <code>{category.slug}</code>
            </p>
          </div>
          <div className="text-end">
            <span className={category.isActive ? "badge text-bg-success" : "badge text-bg-secondary"}>
              {category.isActive ? "Active" : "Inactive"}
            </span>
            <p className="small text-body-secondary mb-0 mt-2">
              Position sur l’accueil : {category.displayOrder}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="row g-4 align-items-start">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-3 p-md-4">
                <h2 className="h4 mb-3">Présentation de l’accueil</h2>

                <fieldset disabled={saving} className="mb-4">
                  <legend className="form-label fw-semibold">
                    Mise en page sur l’accueil <span aria-hidden="true">*</span>
                  </legend>
                  <p className="small text-body-secondary mb-3">
                    Chaque modèle définit automatiquement le nombre maximal
                    d’articles affichés, sans autre réglage.
                  </p>

                  <div className={styles.layoutChoices}>
                    {CATEGORY_APPEARANCE_OPTIONS.map((option) => (
                      <label
                        key={option.layoutType}
                        className={
                          styles.layoutChoice +
                          (layoutType === option.layoutType
                            ? " " + styles.layoutChoiceSelected
                            : "")
                        }
                      >
                        <input
                          type="radio"
                          name="layoutType"
                          value={option.layoutType}
                          checked={layoutType === option.layoutType}
                          onChange={(event) => updateLayout(event.target.value)}
                          aria-invalid={Boolean(fieldErrors.layoutType)}
                          className="form-check-input mt-1"
                        />
                        <span className={styles.choiceDetails}>
                          <span className="d-flex flex-wrap justify-content-between gap-1 mb-1">
                            <strong>{option.label}</strong>
                            <span className="badge text-bg-light text-body border">
                              {option.capacity} articles
                            </span>
                          </span>
                          <span className="small text-body-secondary d-block">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.layoutType && (
                    <p className="text-danger small mt-2 mb-0" role="alert">
                      {fieldErrors.layoutType}
                    </p>
                  )}
                </fieldset>

                <fieldset disabled={saving}>
                  <legend className="form-label fw-semibold">
                    Couleur sur l’accueil <span aria-hidden="true">*</span>
                  </legend>
                  <p className="small text-body-secondary">
                    Utilisée pour souligner la section, sans modifier la couleur
                    des textes ou des boutons.
                  </p>
                  <div className="d-flex flex-wrap align-items-end gap-3">
                    <div>
                      <label htmlFor="category-theme-picker" className="form-label">
                        Sélecteur de couleur
                      </label>
                      <input
                        id="category-theme-picker"
                        type="color"
                        className={"form-control form-control-color " + styles.colorPicker}
                        value={previewColor}
                        onChange={(event) => updateColor(event.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label htmlFor="category-theme-color" className="form-label">
                        Valeur hexadécimale
                      </label>
                      <input
                        id="category-theme-color"
                        type="text"
                        className={
                          "form-control " + styles.colorHex +
                          (fieldErrors.themeColor ? " is-invalid" : "")
                        }
                        value={themeColor}
                        maxLength={16}
                        placeholder="#2563EB"
                        aria-invalid={Boolean(fieldErrors.themeColor)}
                        aria-describedby={
                          fieldErrors.themeColor ? "category-theme-error" : undefined
                        }
                        onChange={(event) => updateColor(event.target.value)}
                        onBlur={() => {
                          const normalized = normalizeThemeColor(themeColor);
                          if (normalized) setThemeColor(normalized);
                        }}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  {fieldErrors.themeColor && (
                    <p
                      id="category-theme-error"
                      className="text-danger small mt-2 mb-0"
                      role="alert"
                    >
                      {fieldErrors.themeColor}
                    </p>
                  )}
                </fieldset>

                <hr className="my-4" />
                <div className="d-flex flex-wrap gap-2 justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={saving}
                    onClick={resetDefaults}
                  >
                    Rétablir les valeurs par défaut
                  </button>
                  <div className="d-flex gap-2">
                    <Link
                      href="/admin/categories"
                      aria-disabled={saving}
                      className={"btn btn-outline-secondary" + (saving ? " disabled" : "")}
                      tabIndex={saving ? -1 : undefined}
                    >
                      Annuler
                    </Link>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || unchanged}
                    >
                      {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <CategoryAppearancePreview
              categoryLabel={categoryLabel}
              layoutType={previewLayout}
              themeColor={previewColor}
            />
            <p className="small text-body-secondary mt-2">
              Modèle sélectionné : <strong>{selectedOption?.label ?? "Non valide"}</strong>,
              {" "}{selectedOption?.capacity ?? 0} articles maximum.
            </p>
          </div>
        </div>
      </form>
    </main>
  );
}
