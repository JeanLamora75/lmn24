import Link from "next/link";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditFeedPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="container py-5">
      <Link
        href="/admin/feeds"
        className="btn btn-outline-secondary btn-sm mb-4"
      >
        Retour aux flux RSS/XML
      </Link>

      <h1 className="h2 mb-3">Modifier le flux RSS/XML</h1>
      <p className="lead text-body-secondary mb-2">
        Le formulaire de modification sera réalisé dans une User Story dédiée.
      </p>
      <p className="small text-body-secondary mb-0">
        Identifiant du flux : <code>{id}</code>
      </p>
    </main>
  );
}
