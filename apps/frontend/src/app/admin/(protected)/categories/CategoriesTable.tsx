"use client";

import { AdminIcon } from "@/components/admin/AdminIcon";
import { useAdminSessionFilter } from "@/lib/admin-session-filters";
import { AdminFilterResetButton } from "@/components/admin/AdminFilterResetButton";
import { AdminDataPanel, AdminFilterPanel, AdminPageHeading } from "@/components/admin/AdminWorkspace";
import { AdminPagination } from "@/components/admin/AdminPagination";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";

import { CategoryHomeOrderEditor } from "./CategoryHomeOrderEditor";
import type { CategoryItem } from "./category-home-order";
import styles from "./categories.module.css";

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

function normalizedSearch(value: string): string {
  return value.trim().toLocaleLowerCase("fr");
}

export function CategoriesTable() {
  const router = useRouter();
  const organizeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOrganizingRef = useRef(false);

  const [items, setItems] = useState<CategoryItem[]>([]);
  const [searchInput, setSearchInput] = useAdminSessionFilter("categories", "searchInput", "");
  const [search, setSearch] = useAdminSessionFilter("categories", "search", "");
  const [status, setStatus] = useAdminSessionFilter<StatusFilter>("categories", "status", "all");
  const [page, setPage] = useAdminSessionFilter("categories", "page", 1);
  const [pageSize, setPageSize] =
    useAdminSessionFilter<(typeof PAGE_SIZES)[number]>("categories", "pageSize", 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [organizing, setOrganizing] = useState(false);
  const [success, setSuccess] = useState("");

  // Restore focus after the editor unmounts (save or cancel).
  useEffect(() => {
    if (wasOrganizingRef.current && !organizing) {
      organizeButtonRef.current?.focus();
    }
    wasOrganizingRef.current = organizing;
  }, [organizing]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/categories", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (!response.ok) {
          throw new Error("load-failed");
        }

        const payload = (await response.json()) as {
          items: CategoryItem[];
        };

        setItems(payload.items);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Impossible de charger les catégories.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, [router]);

  const filteredItems = useMemo(() => {
    const query = normalizedSearch(search);

    return items
      .filter((category) => {
        if (status === "active" && !category.isActive) {
          return false;
        }

        if (status === "inactive" && category.isActive) {
          return false;
        }

        if (!query) {
          return true;
        }

        return normalizedSearch(
          getFrenchCategoryLabel(category.slug),
        ).includes(query);
      })
      .sort((a, b) =>
        getFrenchCategoryLabel(a.slug).localeCompare(
          getFrenchCategoryLabel(b.slug),
          "fr",
          { sensitivity: "base" },
        ),
      );
  }, [items, search, status]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  const visibleItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, pageSize, safePage]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const toggleCategory = async (category: CategoryItem) => {
    if (updatingIds.has(category.id)) {
      return;
    }

    const nextStatus = !category.isActive;

    setUpdatingIds((current) => new Set(current).add(category.id));
    setItems((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, isActive: nextStatus }
          : item,
      ),
    );
    setError("");

    try {
      const response = await fetch(
        "/api/admin/categories/" +
          encodeURIComponent(category.id) +
          "/status",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ isActive: nextStatus }),
        },
      );

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("update-failed");
      }
    } catch {
      setItems((current) =>
        current.map((item) =>
          item.id === category.id
            ? { ...item, isActive: category.isActive }
            : item,
        ),
      );
      setError(
        "La modification du statut n’a pas pu être enregistrée.",
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(category.id);
        return next;
      });
    }
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <AdminFilterResetButton section="categories" />
      <AdminPageHeading title="Catégories" description="Gérez les catégories d’actualités utilisées par LMN24." actions={<button
          type="button"
          ref={organizeButtonRef}
          className="btn btn-outline-primary"
          aria-expanded={organizing}
          aria-controls="category-home-order-panel"
          disabled={loading || organizing || Boolean(error && items.length === 0)}
          onClick={() => {
            setSuccess("");
            setOrganizing(true);
          }}
        >
          Organiser l’accueil
        </button>} />

      <AdminFilterPanel>
      <div className="d-flex flex-column flex-lg-row gap-2 align-items-lg-center mb-3">

        

        <form
          className={"d-flex gap-2 ms-lg-auto " + styles.searchForm}
          role="search"
          onSubmit={submitSearch}
        >
          <label className="visually-hidden" htmlFor="category-search">
            Rechercher une catégorie
          </label>
          <input
            id="category-search"
            type="search"
            className="form-control"
            placeholder="Nom de la catégorie"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="btn btn-outline-primary"><AdminIcon name="search" className="me-2 align-middle" /> 
            Rechercher
          </button>
        </form>
      </div>

      {organizing && (
        <CategoryHomeOrderEditor
          categories={items}
          onSaved={(updated) => {
            setItems(updated);
            setOrganizing(false);
            setError("");
            setSuccess("L’ordre des catégories de l’accueil a été enregistré.");
          }}
          onRefreshed={(updated) => setItems(updated)}
          onCancel={() => setOrganizing(false)}
          onUnauthorized={() => router.replace("/admin/login")}
        />
      )}

      <div className="row g-2 align-items-end mb-4">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="category-status-filter">
            Statut
          </label>
          <select
            id="category-status-filter"
            className="form-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Toutes</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="category-page-size">
            Enregistrements par page
          </label>
          <select
            id="category-page-size"
            className="form-select"
            value={pageSize}
            onChange={(event) => {
              setPageSize(
                Number(event.target.value) as (typeof PAGE_SIZES)[number],
              );
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option value={size} key={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      </AdminFilterPanel>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      ) : null}

      <div className="mb-2">
        <AdminPagination page={safePage} totalPages={totalPages} onPageChange={setPage} position="supérieure" label="catégories" />
      </div>

      <AdminDataPanel label="Catégories d’actualités">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th scope="col" className={styles.statusColumn}>
                Statut
              </th>
              <th scope="col">Catégorie</th>
              <th scope="col" className={"text-center " + styles.orderColumn}>
                Ordre d’accueil
              </th>
              <th scope="col" className={"text-end " + styles.actionsColumn}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-5">
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Chargement…
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-5 text-body-secondary">
                  Aucune catégorie n’a été trouvée.
                </td>
              </tr>
            ) : (
              visibleItems.map((category) => {
                const label = getFrenchCategoryLabel(category.slug);
                const updating = updatingIds.has(category.id);
                const publicUrl =
                  "/fr/category/" + encodeURIComponent(category.slug);
                const editUrl =
                  "/admin/categories/" +
                  encodeURIComponent(category.id) +
                  "/edit";

                return (
                  <tr key={category.id}>
                    <td>
                      <button
                        type="button"
                        className={
                          "btn btn-sm border-0 " +
                          (category.isActive
                            ? styles.activeStatus
                            : styles.inactiveStatus)
                        }
                        title={
                          category.isActive
                            ? "Désactiver la catégorie"
                            : "Activer la catégorie"
                        }
                        aria-label={
                          category.isActive
                            ? "Désactiver " + label
                            : "Activer " + label
                        }
                        aria-pressed={category.isActive}
                        disabled={updating}
                        onClick={() => void toggleCategory(category)}
                      >
                        <Image
                          src={
                            category.isActive
                              ? "/bootstrap-icons/toggle-on.svg"
                              : "/bootstrap-icons/toggle-off.svg"
                          }
                          width={28}
                          height={28}
                          alt=""
                          aria-hidden="true"
                          unoptimized
                        />
                      </button>
                    </td>

                    <td className="fw-medium">{label}</td>
                    <td className="text-center">
                      <span
                        className="badge rounded-pill text-bg-light border text-body"
                        aria-label={"Position sur l’accueil : " + category.displayOrder}
                      >
                        {category.displayOrder}
                      </span>
                    </td>

                    <td className="text-end">
                      <div className="d-none d-lg-flex justify-content-end gap-1">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-secondary lmn-admin-compact-action"
                          title="Ouvrir la page"
                          aria-label={"Ouvrir la page " + label}
                        >
                          <Image
                            src="/bootstrap-icons/box-arrow-up-right.svg"
                            width={18}
                            height={18}
                            alt=""
                            aria-hidden="true"
                            unoptimized
                          />
                        </a>

                        <Link
                          href={editUrl}
                          className="btn btn-sm btn-outline-primary lmn-admin-compact-action"
                          title="Modifier la catégorie"
                          aria-label={"Modifier " + label}
                        >
                          <Image
                            src="/bootstrap-icons/pencil-square.svg"
                            width={18}
                            height={18}
                            alt=""
                            aria-hidden="true"
                            unoptimized
                          />
                        </Link>
                      </div>

                      <details
                        className={"d-lg-none " + styles.mobileActions}
                      >
                        <summary
                          className="btn btn-sm btn-outline-secondary lmn-admin-compact-action"
                          aria-label={"Actions pour " + label}
                          title="Actions"
                        >
                          <Image
                            src="/bootstrap-icons/three-dots-vertical.svg"
                            width={18}
                            height={18}
                            alt=""
                            aria-hidden="true"
                            unoptimized
                          />
                        </summary>

                        <div
                          className={
                            "dropdown-menu show " + styles.mobileActionsMenu
                          }
                        >
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dropdown-item"
                          >
                            Ouvrir la page
                          </a>

                          <Link href={editUrl} className="dropdown-item"><AdminIcon name="pencil-square" className="me-2 align-middle" /> 
                            Modifier
                          </Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </AdminDataPanel>

      <div className="mt-2">
        <AdminPagination page={safePage} totalPages={totalPages} onPageChange={setPage} position="inférieure" label="catégories" />
      </div>

      {!loading ? (
        <p className="small text-body-secondary text-center mt-3 mb-0">
          {filteredItems.length} catégorie
          {filteredItems.length > 1 ? "s" : ""}
        </p>
      ) : null}
    </main>
  );
}
