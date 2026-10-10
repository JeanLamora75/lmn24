import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const table = readFileSync(new URL("./SourcesTable.tsx", import.meta.url), "utf8");
const confirm = readFileSync(new URL("./SourceDeleteDialog.tsx", import.meta.url), "utf8");

describe("SCRUM-14 — colonnes et actions de la liste des journaux", () => {
  it("montre le drapeau avant le nom du pays", () => {
    const country = table.slice(table.indexOf('<td>\n                      <span className={styles.countryCell}>'));
    expect(country.indexOf("<CountryFlag")).toBeGreaterThanOrEqual(0);
    expect(country.indexOf("<CountryFlag")).toBeLessThan(country.indexOf("{countryName(source.country.isoCode2)}"));
  });

  it("affiche et relie les compteurs flux et articles", () => {
    expect(table).toContain("{source.feedCount}");
    expect(table).toContain("{source.articleCount}");
    expect(table).toContain("sourceFeedsHref(source.id, source.name)");
    expect(table).toContain("sourceArticlesHref(source.id)");
  });

  it("affiche la suppression sur desktop et mobile", () => {
    expect(table).toContain('src="/bootstrap-icons/trash.svg"');
    expect(table).toContain('className="dropdown-item text-danger"');
    expect(table).toContain("setDeleteTarget(source)");
    expect(table).toContain("<SourceDeleteDialog");
  });
});

describe("SCRUM-14 — confirmation obligatoire avant suppression", () => {
  it("charge l'impact et interdit la confirmation si son chargement échoue", () => {
    expect(confirm).toContain('/delete-impact"');
    expect(confirm).toContain("impact.feeds");
    expect(confirm).toContain("impact.articles");
    expect(confirm).toContain("disabled={loading || !impact || deleting}");
    expect(confirm).toContain("if (deletingRef.current || !impact || loading) return;");
  });

  it("envoie un DELETE seulement après une action de confirmation", () => {
    expect(confirm).toContain('method: "DELETE"');
    expect(confirm).toContain("onClick={() => void confirmDelete()}");
    expect(confirm).toContain('onClick={() => dialogRef.current?.close()}');
  });
});
