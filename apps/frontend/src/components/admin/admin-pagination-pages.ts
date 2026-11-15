export type AdminPageItem = number | "left" | "right";

/** Stable compact page window for both desktop and mobile admin lists. */
export function adminPaginationItems(page: number, totalPages: number): AdminPageItem[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const current = Math.min(totalPages, Math.max(1, page));
  const items: AdminPageItem[] = [1];
  const first = Math.max(2, current - 1);
  const last = Math.min(totalPages - 1, current + 1);
  if (first > 2) items.push("left");
  for (let index = first; index <= last; index += 1) items.push(index);
  if (last < totalPages - 1) items.push("right");
  items.push(totalPages);
  return items;
}
