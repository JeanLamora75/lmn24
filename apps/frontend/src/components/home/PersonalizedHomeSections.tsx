"use client";

import { useMemo } from "react";
import { useVisitorPreferences } from "@/components/public/VisitorPreferencesProvider";
import { personalizeCategories } from "@/lib/category-personalization";
import { CATEGORY_SETTINGS_COPY } from "@/components/public/visitor-category-copy";
import type { SupportedLocale } from "@lmn24/config";
import { HomeSection } from "./HomeSection";
import type { HomeSectionData } from "./home-data";

type Props = {
  sections: HomeSectionData[];
  labels: Record<string, string>;
  locale: SupportedLocale;
  categoryLinkLabel: string;
  moreNewsLabel: string;
  previousLabel: string;
  nextLabel: string;
};

/** SSR displays editorial order; personalization is applied only after browser hydration. */
export function PersonalizedHomeSections({
  sections, labels, locale, categoryLinkLabel, moreNewsLabel, previousLabel, nextLabel,
}: Props) {
  const { preferences, ready } = useVisitorPreferences();
  const visible = useMemo(() => {
    if (!ready) return sections;
    return personalizeCategories(sections, preferences.categories);
  }, [sections, ready, preferences.categories]);

  if (ready && sections.length > 0 && visible.length === 0) {
    return <p role="status" className="alert alert-info my-4">
      {CATEGORY_SETTINGS_COPY[locale].hiddenHome}
    </p>;
  }
  return <>{visible.map((section, index) => {
    const label = labels[section.slug] ?? section.slug.replaceAll("-", " ");
    return <HomeSection key={section.id} section={section} label={label}
      locale={locale} categoryLinkLabel={categoryLinkLabel.replace("{name}", label)}
      moreNewsLabel={moreNewsLabel} previousLabel={previousLabel}
      nextLabel={nextLabel} aboveFold={index === 0}/>;
  })}</>;
}
