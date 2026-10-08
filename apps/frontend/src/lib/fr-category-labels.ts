import frMessages from "../../../../messages/fr.json";

const labels = frMessages.categories as Record<string, string>;

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getFrenchCategoryLabel(slug: string): string {
  return labels[slug] ?? humanizeSlug(slug);
}
