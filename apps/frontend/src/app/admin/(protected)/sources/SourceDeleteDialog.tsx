"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./sources.module.css";

type Impact = { feeds: number; articles: number };
type Props = {
  source: { id: string; name: string };
  onClose: () => void;
  onDeleted: () => void;
};

export function SourceDeleteDialog({ source, onClose, onDeleted }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deletingRef = useRef(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadImpact() {
      try {
        const response = await fetch(
          "/api/admin/sources/" + encodeURIComponent(source.id) + "/delete-impact",
          { cache: "no-store", signal: controller.signal },
        );
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) throw new Error("impact-unavailable");
        const data = (await response.json()) as Impact;
        if (
          !Number.isSafeInteger(data.feeds) ||
          !Number.isSafeInteger(data.articles) ||
          data.feeds < 0 ||
          data.articles < 0
        ) throw new Error("invalid-impact");
        setImpact(data);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Impossible de vérifier le nombre de flux et d’articles. Suppression désactivée.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadImpact();
    return () => controller.abort();
  }, [router, source.id]);

  async function confirmDelete() {
    if (deletingRef.current || !impact || loading) return;
    deletingRef.current = true;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/sources/" + encodeURIComponent(source.id),
        { method: "DELETE", cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error("delete-failed");
      onDeleted();
    } catch {
      setError("La source n’a pas pu être supprimée. Aucune suppression n’est confirmée.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.deleteDialog}
      aria-labelledby="delete-source-title"
      aria-describedby="delete-source-message"
      onCancel={(event) => { if (deleting) event.preventDefault(); }}
      onClose={onClose}
    >
      <div className="p-4">
        <h2 className="h5 mb-3" id="delete-source-title">Supprimer une source</h2>
        <p id="delete-source-message">
          Confirmez-vous la suppression définitive de <strong>{source.name}</strong> ?
        </p>
        {loading ? (
          <p role="status">Vérification des données associées…</p>
        ) : impact ? (
          <div className="alert alert-warning">
            Cette action effacera <strong>{impact.feeds} flux RSS/XML</strong> et{" "}
            <strong>{impact.articles} articles</strong> rattachés à cette source,
            ainsi que les historiques d’exécution des flux concernés. Cette action est irréversible.
          </div>
        ) : null}
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={deleting}
            onClick={() => dialogRef.current?.close()}
          >Annuler</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={loading || !impact || deleting}
            onClick={() => void confirmDelete()}
          >{deleting ? "Suppression…" : "Supprimer définitivement"}</button>
        </div>
      </div>
    </dialog>
  );
}
