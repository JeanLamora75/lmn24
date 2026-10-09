import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeSection } from "@/components/home/HomeSection";
import {
  prepareHomeSections,
  type HomeSectionData,
} from "@/components/home/home-data";
import styles from "@/components/home/home.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

// Une recharge affiche les changements publiés et la configuration la plus récente.
export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ locale: string }> }>;

type HomeTranslations = {
  heading: string;
  description: string;
  empty: string;
  error: string;
  previous: string;
  next: string;
  carousel: string;
  category: string;
};

async function loadHome(locale: string): Promise<HomeSectionData[]> {
  const url = getBackendUrl() + "/public/home?locale=" + encodeURIComponent(locale);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("home-api-unavailable");
  }
  const payload = (await response.json()) as { items?: HomeSectionData[] };
  if (!Array.isArray(payload.items)) {
    throw new Error("home-api-invalid-response");
  }
  return prepareHomeSections(payload.items);
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const t = messages.home as HomeTranslations;
  const labels = messages.categories as Record<string, string>;

  let sections: HomeSectionData[] | null = null;
  try {
    sections = await loadHome(locale);
  } catch {
    // Une indisponibilité backend ne doit jamais être confondue avec 0 article.
  }

  return (
    <main className={"container px-3 px-lg-4 pb-5 " + styles.home}>
      <header className={styles.pageIntro}>
        <div className={styles.pageEyebrow}>LMN24</div>
        <h1 className={styles.pageTitle}>{t.heading}</h1>
        <p className={styles.pageDescription}>{t.description}</p>
      </header>

      {sections === null ? (
        <div className="alert alert-danger my-4" role="alert">
          {t.error}
        </div>
      ) : sections.length === 0 ? (
        <p role="status" className={styles.emptyMessage}>{t.empty}</p>
      ) : (
        sections.map((section) => {
          const label = labels[section.slug] ??
            section.slug.replace(/-/g, " ");
          return (
            <HomeSection
              key={section.id}
              section={section}
              label={label}
              locale={locale}
              categoryLinkLabel={t.category.replace("{name}", label)}
              previousLabel={t.previous}
              nextLabel={t.next}
            />
          );
        })
      )}
    </main>
  );
}
