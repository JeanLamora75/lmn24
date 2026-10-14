import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HashtagThumbnail } from "@/components/hashtags/HashtagThumbnail";
import { getHashtagLabels } from "@/components/hashtags/hashtag-ranking-data";
import styles from "@/components/hashtags/hashtags.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";
type Props = Readonly<{ params: Promise<{ locale: string; slug: string }> }>;
type PublicHashtag = { id: string; name: string; slug: string; imageUrl: string | null };

async function loadHashtag(slug: string): Promise<PublicHashtag | null> {
  try {
    const response = await fetch(getBackendUrl() + "/hashtags/" + encodeURIComponent(slug), {
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const item = await response.json() as PublicHashtag;
    if (!item || item.slug !== slug || !item.name) return null;
    return item;
  } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { title: "Hashtags | LMN24" };
  }
  const subject = await loadHashtag(slug);
  return { title: subject?.name ?? "Hashtags" };
}

/** The article grid is deliberately reserved for SCRUM-55.
 * This intermediate public profile makes the ranking cards navigable and
 * filters out inactive or unknown hashtags already in SCRUM-54.
 */
export default async function PublicHashtagDetail({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) ||
      slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  setRequestLocale(locale);
  const subject = await loadHashtag(slug);
  if (!subject) notFound();
  const labels = getHashtagLabels(locale);
  return (
    <main className={"container px-3 px-lg-4 " + styles.page}>
      <nav aria-label={labels.back} className="mb-4">
        <Link href={"/" + locale + "/hashtags"} className="text-decoration-none">
          ← {labels.back}
        </Link>
      </nav>
      <article>
        <h1 className="display-6 fw-semibold mb-4">{subject.name}</h1>
        <HashtagThumbnail imageUrl={subject.imageUrl} name={subject.name} size="detail" />
        <p className="alert alert-light border mt-4" role="status">{labels.detailsPending}</p>
      </article>
    </main>
  );
}
