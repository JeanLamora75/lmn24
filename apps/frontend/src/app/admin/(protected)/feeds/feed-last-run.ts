/** Metrics of the latest parser attempt for a feed. */
export type FeedLastRun = {
  startedAt: string;
  durationMs: number | null;
  itemsFound: number;
  articlesImported: number;
  status: string;
  errorMessage: string | null;
};

export function lastRunDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function lastRunDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "—";
  }
  if (durationMs < 1000) return Math.round(durationMs) + " ms";
  if (durationMs < 60_000) return (durationMs / 1000).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  }) + " s";
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return minutes + " min" + (seconds ? " " + seconds + " s" : "");
}

export function lastRunErrorMessage(run: FeedLastRun | null): string {
  return run?.errorMessage?.trim() || "Aucun détail d’erreur n’est disponible pour cette exécution.";
}
