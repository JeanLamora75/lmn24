"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CountryFlag } from "@/components/home/CountryFlag";
import { sourceArticlesHref, sourceFeedsHref } from "@/lib/source-admin-links";

import { SourceDeleteDialog } from "./SourceDeleteDialog";
import styles from "./sources.module.css";

type SourceItem = {
  id: string;
  name: string;
  websiteUrl: string;
  isActive: boolean;
  feedCount: number;
  articleCount: number;
  country: {
    id: string;
    isoCode2: string;
  };
};

type CountryItem = {
  id: string;
  isoCode2: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SourceResponse = {
  items: SourceItem[];
  pagination: Pagination;
};

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["fr"], { type: "region" })
    : null;

function countryName(isoCode2: string): string {
  const code = isoCode2.trim().toUpperCase();
  return regionNames?.of(code) ?? code;
}

function safeWebsiteUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function pageItems(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const result: Array<number | string> = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    result.push("left-ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    result.push(page);
  }

  if (end < total - 1) {
    result.push("right-ellipsis");
  }

  result.push(total);
  return result;
}

function PaginationNav({
  pagination,
  onPageChange,
  position,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  position: "supérieure" | "inférieure";
}) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={"Pagination " + position + " des sources"}
      className="d-flex justify-content-center"
    >
      <ul className="pagination pagination-sm mb-0">
        <li className={"page-item " + (pagination.page === 1 ? "disabled" : "")}>
          <button
            type="button"
            className="page-link"
            aria-label="Page précédente"
            disabled={pagination.page === 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            ‹
          </button>
        </li>

        {pageItems(pagination.page, pagination.totalPages).map((item) =>
          typeof item === "number" ? (
            <li
              className={
                "page-item " +
                (item === pagination.page ? "active" : "")
              }
              key={item}
            >
              <button
                type="button"
                className="page-link"
                aria-current={item === pagination.page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </li>
          ) : (
            <li className="page-item disabled" key={item}>
              <span className="page-link" aria-hidden="true">
                …
              </span>
            </li>
          ),
        )}

        <li
          className={
            "page-item " +
            (pagination.page === pagination.totalPages ? "disabled" : "")
          }
        >
          <button
            type="button"
            className="page-link"
            aria-label="Page suivante"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function SourcesTable() {
  const router = useRouter();

  const [items, setItems] = useState<SourceItem[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [countryId, setCountryId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZES)[number]>(10);
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SourceItem | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const sortedCountries = useMemo(
    () =>
      [...countries].sort((a, b) =>
        countryName(a.isoCode2).localeCompare(
          countryName(b.isoCode2),
          "fr",
          { sensitivity: "base" },
        ),
      ),
    [countries],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadCountries() {
      try {
        const response = await fetch("/api/admin/sources/countries", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          items: CountryItem[];
        };

        setCountries(payload.items);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Impossible de charger la liste des pays.");
        }
      }
    }

    void loadCountries();

    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSources() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(pageSize),
      });

      if (search) {
        params.set("search", search);
      }

      if (countryId) {
        params.set("countryId", countryId);
      }

      try {
        const response = await fetch(
          "/api/admin/sources?" + params.toString(),
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

        const payload = (await response.json()) as SourceResponse;

        setItems(payload.items);
        setPagination(payload.pagination);

        if (payload.pagination.page !== page) {
          setPage(payload.pagination.page);
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Impossible de charger les sources.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSources();

    return () => controller.abort();
  }, [countryId, page, pageSize, reloadKey, router, search, status]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setReloadKey((value) => value + 1);
  };

  const toggleSource = async (source: SourceItem) => {
    if (updatingIds.has(source.id)) {
      return;
    }

    const nextStatus = !source.isActive;

    setUpdatingIds((current) => new Set(current).add(source.id));
    setItems((current) =>
      current.map((item) =>
        item.id === source.id
          ? { ...item, isActive: nextStatus }
          : item,
      ),
    );
    setError("");

    try {
      const response = await fetch(
        "/api/admin/sources/" + encodeURIComponent(source.id) + "/status",
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

      setReloadKey((value) => value + 1);
    } catch {
      setItems((current) =>
        current.map((item) =>
          item.id === source.id
            ? { ...item, isActive: source.isActive }
            : item,
        ),
      );
      setError(
        "La modification du statut n’a pas pu être enregistrée.",
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(source.id);
        return next;
      });
    }
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Sources / Journaux</h1>
        <p className="text-body-secondary mb-0">
          Gérez les sources d’information utilisées par LMN24.
        </p>
      </header>

      <div className="d-flex flex-column flex-lg-row gap-2 align-items-lg-center mb-3">
        <div className="d-flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-outline-secondary">
            Retour à l’administration
          </Link>
          <Link href="/admin/sources/new" className="btn btn-primary">
            Ajouter une source
          </Link>
        </div>

        <form
          className={"d-flex gap-2 ms-lg-auto " + styles.searchForm}
          role="search"
          onSubmit={submitSearch}
        >
          <label className="visually-hidden" htmlFor="source-search">
            Rechercher une source
          </label>
          <input
            id="source-search"
            type="search"
            className="form-control"
            placeholder="Nom de la source"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="btn btn-outline-primary">
            Rechercher
          </button>
        </form>
      </div>

      <div className="row g-2 align-items-end mb-4">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="country-filter">
            Pays
          </label>
          <select
            id="country-filter"
            className="form-select"
            value={countryId}
            onChange={(event) => {
              setCountryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les pays</option>
            {sortedCountries.map((country) => (
              <option value={country.id} key={country.id}>
                {countryName(country.isoCode2)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="status-filter">
            Statut
          </label>
          <select
            id="status-filter"
            className="form-select"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as "all" | "active" | "inactive",
              );
              setPage(1);
            }}
          >
            <option value="all">Toutes</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="page-size">
            Enregistrements par page
          </label>
          <select
            id="page-size"
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

      {notice ? <p className="alert alert-success" role="status">{notice}</p> : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mb-2">
        <PaginationNav
          pagination={pagination}
          onPageChange={setPage}
          position="supérieure"
        />
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th scope="col" className={styles.statusColumn}>
                Statut
              </th>
              <th scope="col">Source</th>
              <th scope="col">Pays</th>
              <th scope="col" className="text-center">Flux RSS/XML</th>
              <th scope="col" className="text-center">Articles</th>
              <th scope="col" className={"text-end " + styles.actionsColumn}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-5">
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-5 text-body-secondary">
                  Aucune source n’a été trouvée.
                </td>
              </tr>
            ) : (
              items.map((source) => {
                const websiteUrl = safeWebsiteUrl(source.websiteUrl);
                const updating = updatingIds.has(source.id);

                return (
                  <tr key={source.id}>
                    <td>
                      <button
                        type="button"
                        className={
                          "btn btn-sm border-0 " +
                          (source.isActive
                            ? styles.activeStatus
                            : styles.inactiveStatus)
                        }
                        title={
                          source.isActive
                            ? "Désactiver la source"
                            : "Activer la source"
                        }
                        aria-label={
                          source.isActive
                            ? "Désactiver " + source.name
                            : "Activer " + source.name
                        }
                        aria-pressed={source.isActive}
                        disabled={updating}
                        onClick={() => void toggleSource(source)}
                      >
                        <Image
                          src={
                            source.isActive
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

                    <td className="fw-medium">{source.name}</td>

                    <td>
                      <span className={styles.countryCell}>
                        <CountryFlag countryIsoCode2={source.country.isoCode2} locale="fr" />
                        <span>{countryName(source.country.isoCode2)}</span>
                      </span>
                    </td>

                    <td className="text-center">
                      <Link
                        href={sourceFeedsHref(source.id, source.name)}
                        className={styles.countLink}
                        title={"Consulter les flux de " + source.name}
                        aria-label={source.feedCount + " flux RSS/XML pour " + source.name}
                      >
                        {source.feedCount}
                      </Link>
                    </td>

                    <td className="text-center">
                      <Link
                        href={sourceArticlesHref(source.id)}
                        className={styles.countLink}
                        title={"Consulter les articles de " + source.name}
                        aria-label={source.articleCount + " articles pour " + source.name}
                      >
                        {source.articleCount}
                      </Link>
                    </td>

                    <td className="text-end">
                      <div className="d-none d-lg-flex justify-content-end gap-1">
                        {websiteUrl ? (
                          <a
                            href={websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                            title="Ouvrir le site"
                            aria-label={"Ouvrir le site de " + source.name}
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
                        ) : null}

                        <Link
                          href={
                            "/admin/sources/" +
                            encodeURIComponent(source.id) +
                            "/edit"
                          }
                          className="btn btn-sm btn-outline-primary"
                          title="Modifier la source"
                          aria-label={"Modifier " + source.name}
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
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title={"Supprimer la source " + source.name}
                          aria-label={"Supprimer la source " + source.name}
                          disabled={updating}
                          onClick={() => setDeleteTarget(source)}
                        >
                          <Image
                            src="/bootstrap-icons/trash.svg"
                            width={18}
                            height={18}
                            alt=""
                            aria-hidden="true"
                            unoptimized
                          />
                        </button>
                      </div>

                      <details
                        className={"d-lg-none " + styles.mobileActions}
                      >
                        <summary
                          className="btn btn-sm btn-outline-secondary"
                          aria-label={"Actions pour " + source.name}
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
                          {websiteUrl ? (
                            <a
                              href={websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dropdown-item"
                            >
                              Ouvrir le site
                            </a>
                          ) : null}

                          <Link
                            href={
                              "/admin/sources/" +
                              encodeURIComponent(source.id) +
                              "/edit"
                            }
                            className="dropdown-item"
                          >
                            Modifier
                          </Link>
                          <button
                            type="button"
                            className="dropdown-item text-danger"
                            disabled={updating}
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              setDeleteTarget(source);
                            }}
                          >
                            Supprimer
                          </button>
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

      <div className="mt-2">
        <PaginationNav
          pagination={pagination}
          onPageChange={setPage}
          position="inférieure"
        />
      </div>

      {deleteTarget && (
        <SourceDeleteDialog
          source={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setNotice("La source et ses données associées ont été supprimées.");
            setDeleteTarget(null);
            setReloadKey((value) => value + 1);
          }}
        />
      )}

      {!loading ? (
        <p className="small text-body-secondary text-center mt-3 mb-0">
          {pagination.total} source{pagination.total > 1 ? "s" : ""}
        </p>
      ) : null}
    </main>
  );
}
