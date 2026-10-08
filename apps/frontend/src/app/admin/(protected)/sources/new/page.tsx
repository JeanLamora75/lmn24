import Link from "next/link";

export default function NewSourcePlaceholderPage() {
  return (
    <main className="container py-5">
      <Link
        href="/admin/sources"
        className="btn btn-outline-secondary btn-sm mb-4"
      >
        ← Retour aux sources
      </Link>

      <h1 className="h2 mb-3">Ajouter une source</h1>
      <p className="lead text-body-secondary mb-0">
        Le formulaire de création sera réalisé dans une User Story dédiée.
      </p>
    </main>
  );
}
