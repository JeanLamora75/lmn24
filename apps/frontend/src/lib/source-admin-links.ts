/** Routes administratives des compteurs de la liste des sources. */
export function sourceFeedsHref(sourceId: string, sourceName: string): string {
  const params = new URLSearchParams({ sourceId, sourceName });
  return "/admin/feeds?" + params.toString();
}

/** Future source articles detail, currently a clearly identified placeholder. */
export function sourceArticlesHref(sourceId: string): string {
  return "/admin/sources/" + encodeURIComponent(sourceId);
}
