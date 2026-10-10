/** Routes administratives des compteurs de la liste des sources. */
export function sourceFeedsHref(sourceId: string, sourceName: string): string {
  const params = new URLSearchParams({ sourceId, sourceName });
  return "/admin/feeds?" + params.toString();
}

/** Open the existing RSS/XML creation form with its source preselected. */
export function newFeedForSourceHref(sourceId: string): string {
  return "/admin/feeds/new?" + new URLSearchParams({ sourceId }).toString();
}

/** Future source articles detail, currently a clearly identified placeholder. */
export function sourceArticlesHref(sourceId: string): string {
  return "/admin/sources/" + encodeURIComponent(sourceId);
}
