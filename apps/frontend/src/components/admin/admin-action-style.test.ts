import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const styles = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
const sourceTable = readFileSync(resolve(root, "src/app/admin/(protected)/sources/SourcesTable.tsx"), "utf8");
const feedTable = readFileSync(resolve(root, "src/app/admin/(protected)/feeds/FeedsTable.tsx"), "utf8");
const categoriesTable = readFileSync(resolve(root, "src/app/admin/(protected)/categories/CategoriesTable.tsx"), "utf8");

describe("admin action icon visual consistency", () => {
  it("uses the same neutral ghost action style for sources, feeds and categories", () => {
    for (const source of [sourceTable, feedTable, categoriesTable]) {
      expect(source).toContain("lmn-admin-compact-action");
    }
    expect(styles).toContain(".btn.lmn-admin-compact-action,");
    expect(styles).toContain("border: 1px solid transparent;");
    expect(styles).toContain("background: var(--bs-tertiary-bg");
    expect(styles).toContain(".btn.lmn-admin-compact-action:hover");
  });
  it("reserves destructive styling for delete, not the YouTube feed creation action", () => {
    const youtubeButton = sourceTable.match(/className="([^"]+)"\s+title=\{"Ajouter un flux vidéo YouTube/);
    expect(youtubeButton?.[1]).toContain("btn-outline-secondary");
    expect(youtubeButton?.[1]).not.toContain("btn-outline-danger");
    expect(styles).toContain(".btn.lmn-admin-compact-action.btn-outline-danger");
  });
  it("keeps descriptive labels for icon-only actions", () => {
    expect(sourceTable).toContain('aria-label={"Supprimer la source " + source.name}');
    expect(feedTable).toContain('aria-label={"Supprimer le flux " + label}');
  });
});
