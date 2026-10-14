import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HashtagThumbnail } from "@/components/hashtags/HashtagThumbnail";
import {
  getHashtagLabels, hashtagRankingHref, parseRankingParams,
  type RankingMode, type RankingPage, type RankingParams, type RankingPeriod,
} from "@/components/hashtags/hashtag-ranking-data";
import styles from "@/components/hashtags/hashtags.module.css";
import { routing } from "@/i18n/routing";
import { getBackendUrl } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
type Props = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

async function getRanking(options: RankingParams): Promise<RankingPage | null> {
  const query = new URLSearchParams({
    period: options.period, mode: options.mode,
    page: String(options.page), pageSize: String(PAGE_SIZE),
  });
  try {
    const response = await fetch(getBackendUrl() + "/hashtags/rankings?" + query, {
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as RankingPage;
    if (!data || !Array.isArray(data.items) || !data.pagination ||
      typeof data.comparisonAvailable !== "boolean" ||
      !["fresh", "stale", "unverified"].includes(data.freshness)) return null;
    return data;
  } catch {
    return null;
  }
}

function formattedDate(iso: string | null | undefined, locale: string): string {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(new Date(iso)) + " UTC";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const labels = getHashtagLabels(locale);
  return { title: labels.title, description: labels.description };
}

export default async function PublicHashtagsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const selected = parseRankingParams(await searchParams);
  const labels = getHashtagLabels(locale);
  const ranking = await getRanking(selected);
  const filterHref = (changes: Partial<RankingParams>) =>
    hashtagRankingHref(locale, { ...selected, ...changes, page: changes.page ?? 1 });
  const freshnessLabel = ranking?.freshness === "fresh" ? labels.fresh
    : ranking?.freshness === "stale" ? labels.stale : labels.unverified;

  return (
    <main className={"container px-3 px-lg-4 " + styles.page}>
      <header className={styles.intro}>
        <h1 className="display-6 fw-semibold mb-2">{labels.title}</h1>
        <p className={styles.subtitle}>{labels.description}</p>
        <span className="badge text-bg-light border">{labels.allLanguages}</span>
      </header>

      <div className={styles.controls}>
        <nav aria-label={labels.title + " : " + labels.mostCited + " / " + labels.trending}
          className={styles.controlGroup}>
          {(["most-cited", "trending"] as const).map((mode: RankingMode) => (
            <Link key={mode} href={filterHref({ mode })}
              aria-current={selected.mode === mode ? "page" : undefined}
              className={styles.controlLink + (selected.mode === mode ? " " + styles.selected : "")}>
              {mode === "most-cited" ? labels.mostCited : labels.trending}
            </Link>
          ))}
        </nav>
        <nav aria-label={labels.title + " : " + labels.periods["24h"] + " / " + labels.periods["30d"]}
          className={styles.controlGroup}>
          {(["24h", "7d", "30d"] as const).map((period: RankingPeriod) => (
            <Link key={period} href={filterHref({ period })}
              aria-current={selected.period === period ? "page" : undefined}
              className={styles.controlLink + (selected.period === period ? " " + styles.selected : "")}>
              {labels.periods[period]}
            </Link>
          ))}
        </nav>
      </div>

      {ranking === null ? (
        <div className="alert alert-danger" role="alert">
          {labels.unavailable}{" "}
          <Link href={filterHref({ page: selected.page })}>{labels.retry}</Link>
        </div>
      ) : (
        <section aria-labelledby="hashtag-ranking-heading">
          <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap">
            <div>
              <h2 id="hashtag-ranking-heading" className="h4 mb-1">
                {selected.mode === "most-cited" ? labels.mostCited : labels.trending}
                {" — "}{labels.periods[selected.period]}
              </h2>
              <p className={styles.headingMeta + " mb-0"}>
                {labels.updated} :{" "}
                <time dateTime={ranking.asOf}>{formattedDate(ranking.asOf, locale)}</time>
                {" · "}{labels.calculated} :{" "}
                <time dateTime={ranking.calculatedAt}>{formattedDate(ranking.calculatedAt, locale)}</time>
              </p>
            </div>
            <span className="small text-body-secondary" role="status">{freshnessLabel}</span>
          </div>

          {(ranking.freshness !== "fresh" ||
            (selected.mode === "trending" && !ranking.comparisonAvailable)) && (
            <p className="alert alert-warning mt-3" role="status">
              {ranking.comparisonReason || labels.insufficientHistory}
            </p>
          )}

          {ranking.items.length === 0 ? (
            <p className="alert alert-light border mt-3" role="status">
              {selected.mode === "trending" && !ranking.comparisonAvailable
                ? labels.insufficientHistory
                : selected.mode === "trending" ? labels.noTrending : labels.empty}
            </p>
          ) : (
            <ol className={styles.grid} start={(ranking.pagination.page - 1) * ranking.pagination.pageSize + 1}>
              {ranking.items.map((item, index) => (
                <li key={item.id}>
                  <article className={styles.topicCard}>
                    <Link className={styles.topicLink}
                      href={"/" + locale + "/hashtags/" + encodeURIComponent(item.slug)}
                      aria-label={item.name}>
                      <HashtagThumbnail imageUrl={item.imageUrl} name={item.name} />
                      <div className={styles.topicContent}>
                        <span className={styles.rank}>
                          #{(ranking.pagination.page - 1) * ranking.pagination.pageSize + index + 1}
                        </span>
                        <h3 className={styles.topicName}>{item.name}</h3>
                      </div>
                    </Link>
                    <div className={"px-3 pb-3 mt-auto " + styles.metrics}>
                      <div>
                        <div className={styles.number}>{item.mentions.toLocaleString(locale)}</div>
                        <div className={styles.metricLabel}>{labels.mentions}</div>
                      </div>
                      <div className="text-end">
                        <div className={styles.change}>
                          {item.previousMentions === null ? "—"
                            : item.previousMentions === 0 && item.mentions > 0
                              ? labels.new : item.changeLabel}
                        </div>
                        <div className={styles.metricLabel}>{labels.variation}</div>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}

          {ranking.pagination.totalPages > 1 && (
            <nav className={styles.pages} aria-label={labels.page}>
              {ranking.pagination.page > 1 && (
                <Link className={styles.pageLink}
                  href={filterHref({ page: ranking.pagination.page - 1 })}>
                  {labels.previous}
                </Link>
              )}
              <span aria-live="polite">
                {labels.page} {ranking.pagination.page} {labels.of} {ranking.pagination.totalPages}
              </span>
              {ranking.pagination.page < ranking.pagination.totalPages && (
                <Link className={styles.pageLink}
                  href={filterHref({ page: ranking.pagination.page + 1 })}>
                  {labels.next}
                </Link>
              )}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
