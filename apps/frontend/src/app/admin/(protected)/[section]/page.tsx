import Link from "next/link";
import { notFound } from "next/navigation";

const SECTIONS = {
  sources: {
    title: "Sources / Journaux",
    description:
      "La gestion détaillée des sources et journaux sera réalisée dans une User Story dédiée.",
  },
  feeds: {
    title: "Flux RSS/XML",
    description:
      "La gestion détaillée des flux RSS/XML sera réalisée dans une User Story dédiée.",
  },
  categories: {
    title: "Catégories",
    description:
      "La gestion détaillée des catégories sera réalisée dans une User Story dédiée.",
  },
  languages: {
    title: "Langues",
    description:
      "La gestion détaillée des langues sera réalisée dans une User Story dédiée.",
  },
  settings: {
    title: "Paramètres",
    description:
      "La gestion détaillée des paramètres sera réalisée dans une User Story dédiée.",
  },
  "parser-run": {
    title: "Lancer le parser",
    description:
      "Le déclenchement manuel du parser sera réalisé dans une User Story dédiée.",
  },
  "parser-monitoring": {
    title: "Logs et statistiques du parser",
    description:
      "La supervision détaillée du parser sera réalisée dans une User Story dédiée.",
  },
  "import-csv": {
    title: "Import CSV",
    description:
      "L’import de données par fichier CSV sera réalisé dans une User Story dédiée.",
  },
  "site-statistics": {
    title: "Statistiques du site",
    description:
      "Les statistiques détaillées du site seront réalisées dans une User Story dédiée.",
  },
} as const;

type Props = Readonly<{
  params: Promise<{ section: string }>;
}>;

export default async function AdminSectionPage({ params }: Props) {
  const { section } = await params;
  const config = SECTIONS[section as keyof typeof SECTIONS];

  if (!config) {
    notFound();
  }

  return (
    <main className="container py-5">
      <Link href="/admin" className="btn btn-outline-secondary btn-sm mb-4">
        ← Retour à l’administration
      </Link>

      <h1 className="h2 mb-3">{config.title}</h1>
      <p className="lead text-body-secondary mb-0">{config.description}</p>
    </main>
  );
}
