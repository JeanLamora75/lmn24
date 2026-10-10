import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./home.module.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(selector + " {");
  if (start === -1) {
    throw new Error("Règle CSS introuvable : " + selector);
  }
  const from = css.indexOf("{", start);
  const to = css.indexOf("}", from);
  return css.slice(from + 1, to);
}

describe("SCRUM-26 — bouton Voir plus d'actualité", () => {
  it("reprend le fond de page et dessine le texte et la bordure dans la couleur de catégorie", () => {
    const normal = rule(".moreNewsLink");
    expect(normal).toContain("background-color: var(--bs-body-bg, #fff)");
    expect(normal).toContain("color: var(--category-accent)");
    expect(normal).toContain("border: 1px solid var(--category-accent)");
    expect(normal).toContain("border-radius: 0.6rem");
  });

  it("inverse le fond et le texte au survol et au focus clavier", () => {
    const hoverAndFocus = css.match(
      /\.moreNewsLink:hover,\s*\.moreNewsLink:focus-visible\s*\{([^}]+)\}/,
    )?.[1];
    expect(hoverAndFocus).toContain("background-color: var(--category-accent)");
    expect(hoverAndFocus).toContain("color: var(--bs-body-bg, #fff)");
    expect(hoverAndFocus).toContain("border-color: var(--category-accent)");
    expect(css).toMatch(/\.moreNewsLink:focus-visible\s*\{\s*outline: 3px solid/);
  });
});

describe("SCRUM-26 — titre de rubrique aux couleurs de la catégorie", () => {
  it("utilise la couleur administrée plutôt que le noir par défaut", () => {
    const normal = rule(".categoryLink");
    expect(normal).toContain("color: var(--category-accent)");
    expect(normal).not.toContain("color: var(--bs-body-color)");
  });

  it("garde la couleur de la rubrique sans souligner son titre au survol", () => {
    const hovered = rule(".categoryLink:hover");
    expect(hovered).toContain("color: var(--category-accent)");
    expect(hovered).toContain("text-decoration: none");
    expect(hovered).not.toContain("text-decoration: underline");
  });

  it("préserve un repère accessible sur le titre de rubrique au focus clavier", () => {
    const focused = rule(".categoryLink:focus-visible");
    expect(focused).toContain("color: var(--category-accent)");
    expect(focused).toContain("text-decoration: underline");
  });
});

describe("SCRUM-26 / SCRUM-27 — drapeau à gauche du nom de la source", () => {
  it("place le composant drapeau AVANT le nom dans la carte partagée", () => {
    const component = readFileSync(new URL("./HomeSection.tsx", import.meta.url), "utf8");
    const start = component.indexOf("<span className={styles.sourceIdentity}>");
    const end = component.indexOf("</span>", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const sourceBlock = component.slice(start, end);

    expect(sourceBlock).toContain("<CountryFlag");
    expect(sourceBlock).toContain("article.source.countryIsoCode2");
    expect(sourceBlock).toContain("<span className={styles.sourceName}>");
    expect(sourceBlock.indexOf("<CountryFlag")).toBeLessThan(
      sourceBlock.indexOf("<span className={styles.sourceName}>"),
    );
  });

  it("conserve l'ordre horizontal normal des éléments", () => {
    const sourceStyle = rule(".sourceIdentity");
    expect(sourceStyle).toContain("display: inline-flex");
    expect(sourceStyle).toContain("align-items: center");
    expect(sourceStyle).not.toContain("row-reverse");
    expect(sourceStyle).not.toContain("direction: rtl");
  });
});

describe("SCRUM-26 / SCRUM-27 — titres d'articles sans soulignement au survol", () => {
  it("ne souligne pas les titres des cartes sur l'accueil et les pages catégories", () => {
    const hover = rule(".articleLink:hover .articleTitle");
    expect(hover).toContain("text-decoration: none");
    expect(hover).not.toContain("text-decoration: underline");
    expect(hover).toContain("color: var(--bs-primary-text-emphasis)");
  });

  it("conserve le focus visible de la carte cliquable", () => {
    const focus = rule(".articleLink:focus-visible");
    expect(focus).toContain("outline: 3px solid");
  });
});
