import Link from "next/link";
import { notFound } from "next/navigation";

type Props = Readonly<{ params: Promise<{ id: string }> }>;

/** URL réservée à la future User Story des articles par source. */
export default async function AdminSourceArticlesPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  return (
    <main className="container px-3 px-lg-4 py-5">
      <h1 className="h2">Articles de la source</h1>
      <p className="alert alert-info my-4">
        La page de consultation des articles de cette source sera définie dans une prochaine User Story.
      </p>
      <Link href="/admin/sources" className="btn btn-outline-secondary">
        Retour aux sources / journaux
      </Link>
    </main>
  );
}
