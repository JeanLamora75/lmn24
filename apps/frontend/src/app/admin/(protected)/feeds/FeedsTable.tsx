"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";

import styles from "./feeds.module.css";

type FeedItem = {
  id: string;
  feedUrl: string;
  isActive: boolean;
  source: {
    name: string;
  };
  category: {
    slug: string;
  };
  language: {
    isoCode2: string;
  };
};

type LanguageItem = {
  isoCode2: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type FeedResponse = {
  items: FeedItem[];
  pagination: Pagination;
};

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

function safeFeedUrl(value: string): string | null {
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
      aria-label={"Pagination " + position + " des flux RSS/XML"}
      className="d-flex justify-content-center"
    >
      <ul className="pagination pagination-sm mb-0">
        <li
          className={
            "page-item " + (pagination.page === 1 ? "disabled" : "")
          }
        >
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
                aria-current={
                  item === pagination.page ? "page" : undefined
                }
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
            (pagination.page === pagination.totalPages
              ? "disabled"
              : "")
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

export function FeedsTable() {
  const router = useRouter();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZES)[number]>(10);
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadLanguages() {
      try {
        const response = await fetch("/api/admin/feeds/languages", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (!response.ok) {
          throw new Error("load-languages-failed");
        }

        const payload = (await response.json()) as {
          items: LanguageItem[];
        };

        setLanguages(payload.items);
      } catch (caught) {
        if (
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setError("Impossible de charger la liste des langues.");
        }
      }
    }

    void loadLanguages();

    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeeds() {
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

      if (language) {
        params.set("language", language);
      }

      try {
        const response = await fetch(
          "/api/admin/feeds?" + params.toString(),
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
          throw new Error("load-feeds-failed");
        }

        const payload = (await response.json()) as FeedResponse;

        setItems(payload.items);
        setPagination(payload.pagination);

        if (payload.pagination.page !== page) {
          setPage(payload.pagination.page);
        }
      } catch (caught) {
        if (
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setError("Impossible de charger les flux RSS/XML.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFeeds();

    return () => controller.abort();
  }, [language, page, pageSize, reloadKey, router, search, status]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setReloadKey((value) => value + 1);
  };

  const toggleFeed = async (feed: FeedItem) => {
    if (updatingIds.has(feed.id)) {
      return;
    }

    const nextStatus = !feed.isActive;

    setUpdatingIds((current) => new Set(current).add(feed.id));
    setItems((current) =>
      current.map((item) =>
        item.id === feed.id
          ? { ...item, isActive: nextStatus }
          : item,
      ),
    );
    setError("");

    try {
      const response = await fetch(
        "/api/admin/feeds/" + encodeURIComponent(feed.id) + "/status",
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
          item.id === feed.id
            ? { ...item, isActive: feed.isActive }
            : item,
        ),
      );
      setError(
        "La modification du statut n’a pas pu être enregistrée.",
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(feed.id);
        return next;
      });
    }
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Flux RSS/XML</h1>
        <p className="text-body-secondary mb-0">
          Gérez les flux RSS/XML utilisés par LMN24.
        </p>
      </header>

      <div className="d-flex flex-column flex-lg-row gap-2 align-items-lg-center mb-3">
        <div className="d-flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-outline-secondary">
            Retour à l’administration
          </Link>
          <Link href="/admin/feeds/new" className="btn btn-primary">
            Nouveau flux RSS/XML
          </Link>
        </div>

        <form
          className={"d-flex gap-2 ms-lg-auto " + styles.searchForm}
          role="search"
          onSubmit={submitSearch}
        >
          <label className="visually-hidden" htmlFor="feed-search">
            Rechercher par nom de source
          </label>
          <input
            id="feed-search"
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
          <label className="form-label" htmlFor="language-filter">
            Langue
          </label>
          <select
            id="language-filter"
            className="form-select"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes les langues</option>
            {languages.map((item) => {
              const code = item.isoCode2.trim().toLowerCase();
              return (
                <option value={code} key={code}>
                  {code.toUpperCase()}
                </option>
              );
            })}
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="feed-status-filter">
            Statut
          </label>
          <select
            id="feed-status-filter"
            className="form-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="feed-page-size">
            Enregistrements par page
          </label>
          <select
            id="feed-page-size"
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
              <th scope="col">Catégorie</th>
              <th scope="col">Langue</th>
              <th scope="col">URL du flux</th>
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
                <td
                  colSpan={6}
                  className="text-center py-5 text-body-secondary"
                >
                  Aucun flux RSS/XML ne correspond à vos critères.
                </td>
              </tr>
            ) : (
              items.map((feed) => {
                const feedUrl = safeFeedUrl(feed.feedUrl);
                const categoryLabel = getFrenchCategoryLabel(
                  feed.category.slug,
                );
                const languageCode = feed.language.isoCode2
                  .trim()
                  .toUpperCase();
                const updating = updatingIds.has(feed.id);
                const label =
                  categoryLabel + " — " + feed.source.name;

                return (
                  <tr key={feed.id}>
                    <td>
                      <button
                        type="button"
                        className={
                          "btn btn-sm border-0 " +
                          (feed.isActive
                            ? styles.activeStatus
                            : styles.inactiveStatus)
                        }
                        title={
                          feed.isActive
                            ? "Désactiver le flux"
                            : "Activer le flux"
                        }
                        aria-label={
                          feed.isActive
                            ? "Désactiver le flux " + label
                            : "Activer le flux " + label
                        }
                        aria-pressed={feed.isActive}
                        disabled={updating}
                        onClick={() => void toggleFeed(feed)}
                      >
                        <Image
                          src={
                            feed.isActive
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

                    <td className="fw-medium">{feed.source.name}</td>

                    <td>{categoryLabel}</td>

                    <td>{languageCode}</td>

                    <td className={styles.urlCell}>
                      <span
                        className={styles.urlText}
                        title={feed.feedUrl}
                      >
                        {feed.feedUrl}
                      </span>
                    </td>

                    <td className="text-end">
                      <div className="d-none d-lg-flex justify-content-end gap-1">
                        {feedUrl ? (
                          <a
                            href={feedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                            title="Ouvrir le flux"
                            aria-label={"Ouvrir le flux " + label}
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
                            "/admin/feeds/" +
                            encodeURIComponent(feed.id) +
                            "/edit"
                          }
                          className="btn btn-sm btn-outline-primary"
                          title="Modifier le flux"
                          aria-label={"Modifier le flux " + label}
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
                          className="btn btn-sm btn-outline-secondary"
                          aria-label={"Actions pour le flux " + label}
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
                            "dropdown-menu show " +
                            styles.mobileActionsMenu
                          }
                        >
                          {feedUrl ? (
                            <a
                              href={feedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dropdown-item"
                            >
                              Ouvrir le flux
                            </a>
                          ) : null}

                          <Link
                            href={
                              "/admin/feeds/" +
                              encodeURIComponent(feed.id) +
                              "/edit"
                            }
                            className="dropdown-item"
                          >
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

      <div className="mt-2">
        <PaginationNav
          pagination={pagination}
          onPageChange={setPage}
          position="inférieure"
        />
      </div>

      {!loading ? (
        <p className="small text-body-secondary text-center mt-3 mb-0">
          {pagination.total} flux RSS/XML
        </p>
      ) : null}
    </main>
  );
}
