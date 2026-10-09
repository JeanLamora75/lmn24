import {
  CATEGORY_HOME_LAYOUTS,
  CATEGORY_HOME_LAYOUT_CAPACITY,
  DEFAULT_CATEGORY_HOME_COLOR,
  DEFAULT_CATEGORY_HOME_LAYOUT,
  type CategoryHomeLayout,
} from "@lmn24/contracts";

export type CategoryAppearance = {
  layoutType: CategoryHomeLayout;
  themeColor: string;
};

export const DEFAULT_CATEGORY_APPEARANCE: CategoryAppearance = {
  layoutType: DEFAULT_CATEGORY_HOME_LAYOUT,
  themeColor: DEFAULT_CATEGORY_HOME_COLOR,
};

const METADATA: Record<
  CategoryHomeLayout,
  { label: string; description: string }
> = {
  FEATURED: {
    label: "À la une + grille",
    description: "Un grand article principal et quatre cartes secondaires.",
  },
  GRID: {
    label: "Grille",
    description: "Trois colonnes sur deux lignes, six cartes équivalentes.",
  },
  LIST: {
    label: "Liste",
    description: "Cinq articles superposés avec miniature et description.",
  },
  SPLIT: {
    label: "Une + deux",
    description: "Un article principal et deux articles secondaires.",
  },
  MOSAIC: {
    label: "Mosaïque",
    description: "Un grand visuel et quatre petites cartes asymétriques.",
  },
  COMPACT: {
    label: "Grille compacte",
    description: "Quatre colonnes sur deux lignes, huit cartes.",
  },
  HEADLINES: {
    label: "Titres d’actualité",
    description: "Dix titres dans une présentation dense.",
  },
  CAROUSEL: {
    label: "Carrousel",
    description: "Six cartes défilables horizontalement.",
  },
};

export const CATEGORY_APPEARANCE_OPTIONS = CATEGORY_HOME_LAYOUTS.map(
  (layoutType) => ({
    layoutType,
    capacity: CATEGORY_HOME_LAYOUT_CAPACITY[layoutType],
    ...METADATA[layoutType],
  }),
);

export function isCategoryHomeLayout(value: unknown): value is CategoryHomeLayout {
  return (
    typeof value === "string" &&
    CATEGORY_HOME_LAYOUTS.some((layoutType) => layoutType === value)
  );
}

export function normalizeThemeColor(raw: string): string | null {
  const value = raw.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return value.toUpperCase();
}

export function validateCategoryAppearance(input: {
  layoutType: unknown;
  themeColor: string;
}): {
  value: CategoryAppearance | null;
  errors: { layoutType?: string; themeColor?: string };
} {
  const errors: { layoutType?: string; themeColor?: string } = {};
  if (!isCategoryHomeLayout(input.layoutType)) {
    errors.layoutType = "Choisissez une mise en page parmi les huit modèles.";
  }
  const color = normalizeThemeColor(input.themeColor);
  if (!color) {
    errors.themeColor = "Saisissez une couleur au format #RRGGBB (six chiffres hexadécimaux).";
  }
  if (!isCategoryHomeLayout(input.layoutType) || !color) {
    return { value: null, errors };
  }
  return { value: { layoutType: input.layoutType, themeColor: color }, errors };
}
