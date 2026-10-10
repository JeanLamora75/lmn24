import {
  CATEGORY_HOME_LAYOUTS,
  CATEGORY_HOME_LAYOUT_CAPACITY,
  DEFAULT_CATEGORY_HOME_COLOR,
  type CategoryHomeLayout,
} from "@lmn24/contracts";

export type HomeArticle = {
  id: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  articleUrl: string;
  publishedAt: string;
  source: { name: string; logoUrl: string | null };
};

export type HomeSectionData = {
  id: string;
  slug: string;
  displayOrder: number;
  layoutType: CategoryHomeLayout;
  themeColor: string;
  articles: HomeArticle[];
};

/**
 * Conserve explicitement la locale de consultation lors de la navigation
 * vers la page dédiée de la catégorie. Les slugs sont encodés par segment.
 */
export function localizedCategoryHref(locale: string, slug: string): string {
  return "/" + encodeURIComponent(locale) +
    "/category/" + encodeURIComponent(slug);
}

/**
 * Choisit la couleur du texte d'un bouton dont le fond reprend exactement
 * la couleur de la catégorie. Le seuil WCAG garantit >= 4,5:1 de contraste.
 */
export function getContrastingTextColor(themeColor: string): "#000000" | "#FFFFFF" {
  const color = /^#[0-9a-fA-F]{6}$/.test(themeColor)
    ? themeColor
    : DEFAULT_CATEGORY_HOME_COLOR;

  const linearChannel = (hex: string): number => {
    const channel = Number.parseInt(hex, 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * linearChannel(color.slice(1, 3)) +
    0.7152 * linearChannel(color.slice(3, 5)) +
    0.0722 * linearChannel(color.slice(5, 7));

  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * Défense côté rendu : ordre déterministe et limitation sans cartes fictives,
 * y compris si le contrat API est mal renseigné ou évolue.
 */
export function prepareHomeSections(
  items: readonly HomeSectionData[],
): HomeSectionData[] {
  return items
    .filter(
      (section) =>
        CATEGORY_HOME_LAYOUTS.some((layout) => layout === section.layoutType) &&
        Array.isArray(section.articles),
    )
    .map((section) => ({
      ...section,
      themeColor: /^#[0-9A-Fa-f]{6}$/.test(section.themeColor)
        ? section.themeColor.toUpperCase()
        : DEFAULT_CATEGORY_HOME_COLOR,
      articles: section.articles
        .filter(
          (article) =>
            Boolean(article?.id) &&
            Boolean(article?.title?.trim()) &&
            Boolean(safeExternalUrl(article?.articleUrl)) &&
            !Number.isNaN(new Date(article.publishedAt).getTime()),
        )
        .sort((a, b) => {
          const byPublication =
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime();
          return byPublication || b.id.localeCompare(a.id, "en");
        })
        .slice(0, CATEGORY_HOME_LAYOUT_CAPACITY[section.layoutType]),
    }))
    .filter((section) => section.articles.length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
