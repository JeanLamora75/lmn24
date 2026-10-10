type SourceChoice = { id: string };

/** La source demandée par l'URL doit être présente dans les choix chargés du backend. */
export function resolveInitialFeedSourceId(
  requestedId: string | undefined,
  sources: readonly SourceChoice[],
): string {
  return requestedId && sources.some((source) => source.id === requestedId)
    ? requestedId
    : "";
}
