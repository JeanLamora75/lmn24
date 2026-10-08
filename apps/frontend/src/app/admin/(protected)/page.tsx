import Image from "next/image";
import Link from "next/link";

import styles from "./admin-home.module.css";

const ADMIN_FEATURES = [
  {
    href: "/admin/sources",
    icon: "newspaper",
    title: "Sources / Journaux",
    description:
      "Gérer les différentes sources d’information utilisées par LMN24.",
  },
  {
    href: "/admin/feeds",
    icon: "rss",
    title: "Flux RSS/XML",
    description:
      "Configurer les flux associés aux sources et leurs paramètres de collecte.",
  },
  {
    href: "/admin/categories",
    icon: "tags",
    title: "Catégories",
    description:
      "Consulter et gérer les catégories d’actualités disponibles dans LMN24.",
  },
  {
    href: "/admin/languages",
    icon: "translate",
    title: "Langues",
    description:
      "Gérer les langues proposées sur le site public.",
  },
  {
    href: "/admin/settings",
    icon: "gear",
    title: "Paramètres",
    description:
      "Accéder aux principaux paramètres de configuration de l’application.",
  },
  {
    href: "/admin/parser-run",
    icon: "play-circle",
    title: "Lancer le parser",
    description:
      "Déclencher manuellement une exécution du parser.",
  },
  {
    href: "/admin/parser-monitoring",
    icon: "activity",
    title: "Logs et statistiques du parser",
    description:
      "Consulter les logs d’exécution et les indicateurs de supervision du parser.",
  },
  {
    href: "/admin/import-csv",
    icon: "filetype-csv",
    title: "Import CSV",
    description:
      "Importer des données dans LMN24 à partir d’un fichier CSV.",
  },
  {
    href: "/admin/site-statistics",
    icon: "bar-chart",
    title: "Statistiques du site",
    description:
      "Consulter les principales statistiques d’utilisation du site public.",
  },
] as const;

export default function AdminHomePage() {
  return (
    <main className="container py-4 py-lg-5">
      <header className="mb-4 mb-lg-5">
        <h1 className="display-6 fw-semibold mb-2">Administration LMN24</h1>
        <p className="lead text-body-secondary mb-0">
          Sélectionnez une fonctionnalité pour administrer, superviser ou
          maintenir LMN24.
        </p>
      </header>

      <div className="row g-4">
        {ADMIN_FEATURES.map((feature) => (
          <div className="col-12 col-md-6 col-lg-4" key={feature.href}>
            <Link
              href={feature.href}
              className={styles.cardLink}
              aria-label={feature.title}
            >
              <article className={`card h-100 border-0 shadow-sm ${styles.card}`}>
                <div className="card-body p-4">
                  <div className={styles.iconWrapper} aria-hidden="true">
                    <Image
                      src={`/bootstrap-icons/${feature.icon}.svg`}
                      width={48}
                      height={48}
                      alt=""
                      unoptimized
                    />
                  </div>

                  <h2 className="h5 mt-3 mb-2">{feature.title}</h2>
                  <p className="text-body-secondary mb-0">
                    {feature.description}
                  </p>
                </div>
              </article>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
