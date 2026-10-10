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

  it("conserve la couleur de catégorie et souligne le lien au survol et au focus", () => {
    const hovered = css.match(
      /\\.categoryLink:hover,\\s*\\.categoryLink:focus-visible\\s*\\{([^}]+)\\}/,
    )?.[1];
    expect(hovered).toContain("color: var(--category-accent)");
    expect(hovered).toContain("text-decoration: underline");
    expect(hovered).toContain("text-decoration-color: var(--category-accent)");
  });
});
