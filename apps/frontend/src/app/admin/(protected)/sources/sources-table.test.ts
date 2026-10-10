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

describe("SCRUM-14 / SCRUM-21 — raccourci création de flux par source", () => {
  it("place le raccourci Ajouter un flux en deuxième position sur desktop", () => {
    const start = table.indexOf('className="d-none d-lg-flex justify-content-end gap-1"');
    const end = table.indexOf("<details", start);
    const actions = table.slice(start, end);
    const site = actions.indexOf('/bootstrap-icons/box-arrow-up-right.svg');
    const create = actions.indexOf('newFeedForSourceHref(source.id)');
    const edit = actions.indexOf('/bootstrap-icons/pencil-square.svg');
    const remove = actions.indexOf('/bootstrap-icons/trash.svg');
    expect(site).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(site);
    expect(edit).toBeGreaterThan(create);
    expect(remove).toBeGreaterThan(edit);
    expect(actions).toContain('title={"Ajouter un flux RSS/XML à " + source.name}');
  });

  it("place aussi Ajouter un flux en deuxième position sur mobile", () => {
    const start = table.indexOf('className={"d-lg-none " + styles.mobileActions}');
    const end = table.indexOf("</details>", start);
    const actions = table.slice(start, end);
    const site = actions.indexOf("Ouvrir le site");
    const create = actions.indexOf("Ajouter un flux RSS/XML");
    const edit = actions.indexOf("Modifier");
    const remove = actions.indexOf("Supprimer");
    expect(site).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(site);
    expect(edit).toBeGreaterThan(create);
    expect(remove).toBeGreaterThan(edit);
    expect(actions).toContain("newFeedForSourceHref(source.id)");
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
