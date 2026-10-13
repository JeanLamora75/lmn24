"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string; name: string; slug: string; imageUrl: string | null;
  isActive: boolean; hourlyCountRows: number;
  aliases: Array<{ id: string; name: string; languageIsoCode2: string | null }>;
};
type ResponseData = {
  items: Item[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

async function message(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string | string[] };
    return Array.isArray(data.message) ? data.message.join(" ") : data.message || "Opération impossible.";
  } catch { return "Opération impossible."; }
}
export function HashtagsAdmin() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<ResponseData["pagination"]>({
    page: 1, pageSize: 10, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize), status,
        ...(search ? { search } : {}),
      });
      try {
        const response = await fetch("/api/admin/hashtags?" + params, {
          cache: "no-store", signal: ctrl.signal,
        });
        if (response.status === 401) { router.replace("/admin/login"); return; }
        if (response.status === 403) throw new Error("Accès réservé aux administrateurs.");
        if (!response.ok) throw new Error(await message(response));
        const data = await response.json() as ResponseData;
        if (!ctrl.signal.aborted) {
          setItems(data.items); setPagination(data.pagination);
        }
      } catch (caught) {
        if (!ctrl.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Impossible de charger les hashtags.");
        }
      } finally { if (!ctrl.signal.aborted) setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [page, pageSize, search, status, router, revision]);

  const toggle = async (item: Item) => {
    setBusyId(item.id);
    setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/hashtags/" + encodeURIComponent(item.id) + "/status", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!response.ok) throw new Error(await message(response));
      setNotice("Statut du hashtag enregistré."); refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification impossible.");
    } finally { setBusyId(""); }
  };

  const remove = async (item: Item) => {
    const aliasCount = item.aliases.length;
    if (!window.confirm(
      'Supprimer définitivement « ' + item.name + ' » et ses ' + aliasCount +
      ' alias ainsi que ' + item.hourlyCountRows +
      ' compteur(s) horaires ? Les articles ne seront pas supprimés.',
    )) return;
    setBusyId(item.id); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/hashtags/" + encodeURIComponent(item.id), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await message(response));
      setNotice("Hashtag supprimé."); refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suppression impossible.");
    } finally { setBusyId(""); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault(); setPage(1); setSearch(searchInput.trim());
  };

  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Hashtags</h1>
          <p className="text-body-secondary mb-0">Gérer les sujets et leurs alias multilingues.</p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" href="/admin">Retour admin</Link>
          <Link className="btn btn-primary" href="/admin/hashtags/new">Ajouter un hashtag</Link>
        </div>
      </div>
      <form className="row g-2 mb-3" onSubmit={submit}>
        <div className="col-md-6">
          <label className="visually-hidden" htmlFor="hashtag-search">Rechercher</label>
          <input className="form-control" id="hashtag-search" value={searchInput}
            placeholder="Rechercher un nom, un slug ou un alias…"
            onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="visually-hidden" htmlFor="hashtag-status">Statut</label>
          <select id="hashtag-status" className="form-select" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
        <div className="col-md-3">
          <button className="btn btn-outline-primary w-100" type="submit">Rechercher</button>
        </div>
      </form>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-2 align-items-center">
        <span className="text-body-secondary small">{pagination.total} hashtag(s) correspondant aux filtres</span>
        <label className="d-flex align-items-center gap-2 small">
          Par page
          <select className="form-select form-select-sm" value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light"><tr>
            <th>Nom</th><th>Alias</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4}>Chargement…</td></tr>
              : items.length === 0 ? <tr><td colSpan={4}>Aucun hashtag trouvé.</td></tr>
              : items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><div className="small text-body-secondary">#{item.slug}</div></td>
                  <td className="small">{item.aliases.length ?
                    item.aliases.map((a) => a.name + (a.languageIsoCode2 ?
                      " (" + a.languageIsoCode2 + ")" : "")).join(", ") : "—"}</td>
                  <td>
                    <div className="form-check form-switch">
                      <input type="checkbox" className="form-check-input"
                        aria-label={"Activer ou désactiver " + item.name}
                        checked={item.isActive} disabled={busyId === item.id}
                        onChange={() => void toggle(item)} />
                      <span className="small">{item.isActive ? "Actif" : "Inactif"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <Link className="btn btn-sm btn-outline-primary"
                        href={"/admin/hashtags/" + item.id + "/edit"}>Modifier</Link>
                      <button type="button" className="btn btn-sm btn-outline-danger"
                        disabled={busyId === item.id} onClick={() => void remove(item)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pagination.totalPages > 1 && (
        <nav aria-label="Pagination des hashtags" className="d-flex justify-content-center align-items-center gap-3">
          <button className="btn btn-sm btn-outline-secondary" type="button"
            disabled={pagination.page <= 1} onClick={() => setPage((v) => v - 1)}>Précédent</button>
          <span className="small">Page {pagination.page} / {pagination.totalPages}</span>
          <button className="btn btn-sm btn-outline-secondary" type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((v) => v + 1)}>Suivant</button>
        </nav>
      )}
    </main>
  );
}
