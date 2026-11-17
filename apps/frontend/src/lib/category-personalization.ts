/** Category preferences refer to stable category UUIDs, never localized slugs.
 * Unlisted/new categories retain their editorial order and are enabled by default.
 */
export type CategoryChoice = { order: readonly string[]; hidden: readonly string[] };
export function orderCategories<T extends { id: string; displayOrder: number }>(
  items: readonly T[], order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const left = rank.get(a.id), right = rank.get(b.id);
    if (left !== undefined && right !== undefined) return left - right;
    if (left !== undefined) return -1;
    if (right !== undefined) return 1;
    return a.displayOrder - b.displayOrder || a.id.localeCompare(b.id);
  });
}
export function personalizeCategories<T extends { id: string; displayOrder: number }>(
  items: readonly T[], settings: CategoryChoice,
): T[] {
  const hidden = new Set(settings.hidden);
  return orderCategories(items.filter(item => !hidden.has(item.id)), settings.order);
}

/** Move one existing category to a drop target, preserving all other items' order.
 * No-op on missing IDs and self drops. Also used for keyboard reordering.
 */
export function moveCategoryOrder(
  ids: readonly string[], sourceId: string, targetId: string,
): string[] {
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const result = [...ids];
  result.splice(from, 1);
  result.splice(to, 0, sourceId);
  return result;
}
