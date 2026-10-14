/**
 * SCRUM-13 — one source of truth for the administration home.
 *
 * Register new links in the appropriate section rather than adding bespoke
 * card markup. The order is intentional and follows the agreed UX grouping.
 */
export type AdminFeature = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

export type AdminSection = {
  id: string;
  title: string;
  icon: string;
  features: readonly AdminFeature[];
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: "sources",
    title: "Sources et flux",
    icon: "rss",
    features: [
      {
        href: "/admin/sources",
        icon: "newspaper",
        title: "Sources / Journaux",
        description: "Gérer les différentes sources d’information utilisées par LMN24.",
      },
      {
        href: "/admin/feeds",
        icon: "rss",
        title: "Flux RSS/XML",
        description: "Configurer les flux associés aux sources et leurs paramètres de collecte.",
      },
      {
        href: "/admin/video-feeds",
        icon: "youtube",
        title: "Flux vidéo YouTube",
        description: "Administrer les chaînes et leurs flux Atom XML.",
      },
    ],
  },
  {
    id: "contents",
    title: "Contenus et référentiels",
    icon: "tags",
    features: [
      {
        href: "/admin/videos",
        icon: "youtube",
        title: "Vidéos collectées",
        description: "Consulter, classer et modérer les vidéos YouTube importées.",
      },
      {
        href: "/admin/categories",
        icon: "tags",
        title: "Catégories",
        description: "Consulter et gérer les catégories d’actualités disponibles dans LMN24.",
      },
      {
        href: "/admin/hashtags",
        icon: "hash",
        title: "Hashtags",
        description: "Gérer les sujets suivis et leurs alias multilingues.",
      },
    ],
  },
  {
    id: "collection",
    title: "Collecte et supervision",
    icon: "activity",
    features: [
      {
        href: "/admin/parser",
        icon: "play-circle",
        title: "Lancer le Parser Infos",
        description: "Déclencher la collecte des flux RSS/XML d’actualités.",
      },
      {
        href: "/admin/video-parser",
        icon: "play-circle",
        title: "Lancer le Parser Vidéos",
        description: "Déclencher la collecte des flux XML YouTube et suivre son avancement.",
      },
      {
        href: "/admin/parser-monitoring",
        icon: "activity",
        title: "Logs et statistiques des parsers",
        description: "Centraliser les logs d’exécution et les indicateurs de supervision des parsers Infos et Vidéos.",
      },
    ],
  },
  {
    id: "analysis",
    title: "Analyse et configuration",
    icon: "bar-chart",
    features: [
      {
        href: "/admin/site-statistics",
        icon: "bar-chart",
        title: "Statistiques du site",
        description: "Consulter les principales statistiques d’utilisation du site public.",
      },
      {
        href: "/admin/hashtag-trends",
        icon: "graph-up-arrow",
        title: "Paramètres des tendances",
        description: "Ajuster les seuils de progression et de classement des hashtags.",
      },
      {
        href: "/admin/languages",
        icon: "translate",
        title: "Langues",
        description: "Gérer les langues proposées sur le site public.",
      },
      {
        href: "/admin/settings",
        icon: "gear",
        title: "Paramètres",
        description: "Accéder aux principaux paramètres de configuration de l’application.",
      },
    ],
  },
  {
    id: "maintenance",
    title: "Données et maintenance",
    icon: "clock-history",
    features: [
      {
        href: "/admin/import-csv",
        icon: "filetype-csv",
        title: "Import CSV",
        description: "Importer des données dans LMN24 à partir d’un fichier CSV.",
      },
      {
        href: "/admin/retention",
        icon: "clock-history",
        title: "Conservation des données",
        description: "Configurer séparément les durées de conservation des articles, vidéos et historiques.",
      },
      {
        href: "/admin/data-purge",
        icon: "trash",
        title: "Purge manuelle des données",
        description: "Prévisualiser et purger une table de données à la fois avec confirmation.",
      },
    ],
  },
] as const;

/** Search is case- and accent-insensitive for the user's French labels. */
export function normalizeAdminSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export function filterAdminSections(
  sections: readonly AdminSection[],
  rawQuery: string,
): AdminSection[] {
  const query = normalizeAdminSearch(rawQuery);
  if (!query) return sections.map(section => ({ ...section, features: [...section.features] }));

  return sections.flatMap(section => {
    const sectionMatches = normalizeAdminSearch(section.title).includes(query);
    const features = sectionMatches ? [...section.features] : section.features.filter(feature =>
      normalizeAdminSearch(feature.title).includes(query)
      || normalizeAdminSearch(feature.description).includes(query),
    );
    return features.length ? [{ ...section, features }] : [];
  });
}
