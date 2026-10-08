import { notFound } from "next/navigation";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";

type Props = Readonly<{
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}>;

export default async function PublicCategoryPlaceholderPage({ params }: Props) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return (
    <main className="container py-5">
      <h1 className="display-6 mb-3">
        {getFrenchCategoryLabel(slug)}
      </h1>
      <p className="lead text-body-secondary mb-0">
        La page publique détaillée de cette catégorie sera développée dans une
        User Story dédiée.
      </p>
    </main>
  );
}
