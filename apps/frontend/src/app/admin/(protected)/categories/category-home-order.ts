export type CategoryItem = {
  id: string;
  slug: string;
  isActive: boolean;
  displayOrder: number;
};

export function byHomeOrder(items: readonly CategoryItem[]): CategoryItem[] {
  return [...items].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.slug.localeCompare(right.slug, "fr"),
  );
}

export function moveCategory(
  items: readonly CategoryItem[],
  draggedId: string,
  targetId: string,
): CategoryItem[] {
  const from = items.findIndex((item) => item.id === draggedId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) {
    return [...items];
  }

  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  if (!moved) {
    return [...items];
  }
  reordered.splice(to, 0, moved);
  return reordered;
}

export function moveCategoryBy(
  items: readonly CategoryItem[],
  id: string,
  delta: -1 | 1,
): CategoryItem[] {
  const index = items.findIndex((item) => item.id === id);
  const target = items[index + delta];
  if (index < 0 || !target) {
    return [...items];
  }
  return moveCategory(items, id, target.id);
}

export function hasOrderChanged(
  current: readonly CategoryItem[],
  originalIds: readonly string[],
): boolean {
  return current.length !== originalIds.length ||
    current.some((item, index) => item.id !== originalIds[index]);
}
