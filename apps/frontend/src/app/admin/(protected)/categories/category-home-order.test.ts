import { describe, expect, it } from "vitest";

import {
  byHomeOrder,
  hasOrderChanged,
  moveCategory,
  moveCategoryBy,
  type CategoryItem,
} from "./category-home-order";

const items: CategoryItem[] = [
  { id: "a", slug: "sports", isActive: true, displayOrder: 2 },
  { id: "b", slug: "technology", isActive: false, displayOrder: 1 },
  { id: "c", slug: "international", isActive: true, displayOrder: 3 },
];

describe("organisation de l'accueil / SCRUM-15", () => {
  it("classe toutes les catégories, actives comme inactives, selon displayOrder", () => {
    expect(byHomeOrder(items).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("déplace une catégorie par glisser-déposer sans modifier la liste originale", () => {
    const ordered = byHomeOrder(items);
    const next = moveCategory(ordered, "b", "c");
    expect(next.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(ordered.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("déplace vers le haut ou vers le bas au clavier", () => {
    const ordered = byHomeOrder(items);
    expect(moveCategoryBy(ordered, "a", -1).map((item) => item.id)).toEqual([
      "a", "b", "c",
    ]);
    expect(moveCategoryBy(ordered, "a", 1).map((item) => item.id)).toEqual([
      "b", "c", "a",
    ]);
  });

  it("ignore les déplacements en dehors de la liste et les identifiants inconnus", () => {
    const ordered = byHomeOrder(items);
    expect(moveCategoryBy(ordered, "b", -1)).toEqual(ordered);
    expect(moveCategoryBy(ordered, "c", 1)).toEqual(ordered);
    expect(moveCategory(ordered, "unknown", "a")).toEqual(ordered);
  });

  it("détecte une réorganisation, y compris quand une catégorie inactive est déplacée", () => {
    const ordered = byHomeOrder(items);
    const baseline = ordered.map((item) => item.id);
    expect(hasOrderChanged(ordered, baseline)).toBe(false);
    expect(hasOrderChanged(moveCategoryBy(ordered, "b", 1), baseline)).toBe(true);
    expect(hasOrderChanged(ordered, baseline.slice(1))).toBe(true);
  });
});
