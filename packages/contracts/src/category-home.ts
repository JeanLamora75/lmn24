// Catalogue fonctionnel partagé par les API et les futures interfaces LMN24.
// La capacité n'est pas une colonne de Category ni un paramètre Setting.
export const CATEGORY_HOME_LAYOUT_CAPACITY = {
  FEATURED: 5,
  GRID: 6,
  LIST: 5,
  SPLIT: 3,
  MOSAIC: 5,
  COMPACT: 8,
  HEADLINES: 10,
  CAROUSEL: 6,
} as const;

export const CATEGORY_HOME_LAYOUTS = [
  "FEATURED",
  "GRID",
  "LIST",
  "SPLIT",
  "MOSAIC",
  "COMPACT",
  "HEADLINES",
  "CAROUSEL",
] as const;

export type CategoryHomeLayout = (typeof CATEGORY_HOME_LAYOUTS)[number];
export const DEFAULT_CATEGORY_HOME_LAYOUT: CategoryHomeLayout = "GRID";
export const DEFAULT_CATEGORY_HOME_COLOR = "#2563EB";
