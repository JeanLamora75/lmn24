import type { CategoryHomeLayout } from "@lmn24/contracts";

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
