"use client";

import { useRef, type CSSProperties } from "react";

import {
  CATEGORY_HOME_LAYOUT_CAPACITY,
  type CategoryHomeLayout,
} from "@lmn24/contracts";

import styles from "./category-appearance.module.css";

type Props = {
  categoryLabel: string;
  layoutType: CategoryHomeLayout;
  themeColor: string;
};

const PLACEHOLDER_HEADLINES = [
  "Les informations essentielles de la journée",
  "Un autre sujet à suivre dans cette rubrique",
  "Les principaux faits à retenir",
  "Les développements les plus récents",
  "L’actualité expliquée en quelques mots",
  "Un nouveau titre pour illustrer la grille",
  "Une information complémentaire",
  "Ce qui fait l’actualité en ce moment",
  "Un article supplémentaire en exemple",
  "Dernière manchette de démonstration",
] as const;

const layoutClasses: Record<CategoryHomeLayout, string> = {
  FEATURED: styles.featured,
  GRID: styles.grid,
  LIST: styles.list,
  SPLIT: styles.split,
  MOSAIC: styles.mosaic,
  COMPACT: styles.compact,
  HEADLINES: styles.headlines,
  CAROUSEL: styles.carousel,
};

export function CategoryAppearancePreview({
  categoryLabel,
  layoutType,
  themeColor,
}: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const capacity = CATEGORY_HOME_LAYOUT_CAPACITY[layoutType];

  const containerStyle = {
    "--home-accent": themeColor,
  } as CSSProperties;

  const isCarousel = layoutType === "CAROUSEL";

  function scrollCarousel(direction: -1 | 1) {
    const node = carouselRef.current;
    if (!node) return;

    const firstCard = node.querySelector<HTMLElement>("article");
    const distance = (firstCard?.getBoundingClientRect().width ?? 250) + 12;
    node.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  return (
    <section
      className={"card h-100 " + styles.previewPanel}
      aria-labelledby="category-preview-title"
    >
      <div className="card-body p-3 p-xl-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 id="category-preview-title" className="h5 mb-0">
            Aperçu de l’accueil
          </h2>
          <span className="badge text-bg-secondary">
            {capacity} articles maximum
          </span>
        </div>
        <p className="small text-body-secondary mb-3">
          Simulation avec des articles fictifs, non publiés sur LMN24.
          L’agencement s’adapte à la largeur de l’écran.
        </p>

        <div className={styles.previewFrame} style={containerStyle}>
          <div className={styles.previewHeader}>
            <div className={styles.previewAccent} aria-hidden="true" />
            <h3 className="h5 mb-0">{categoryLabel}</h3>
          </div>

          {isCarousel && (
            <div className="d-flex justify-content-end gap-2 mb-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                aria-label="Faire défiler l’aperçu vers la gauche"
                onClick={() => scrollCarousel(-1)}
              >
                ← Précédent
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                aria-label="Faire défiler l’aperçu vers la droite"
                onClick={() => scrollCarousel(1)}
              >
                Suivant →
              </button>
            </div>
          )}

          <div
            className={styles.previewCards + " " + layoutClasses[layoutType]}
            ref={isCarousel ? carouselRef : undefined}
            role={isCarousel ? "region" : undefined}
            aria-roledescription={isCarousel ? "carrousel de démonstration" : undefined}
            aria-label={isCarousel ? "Six articles fictifs" : undefined}
            tabIndex={isCarousel ? 0 : undefined}
          >
            {Array.from({ length: capacity }, (_, index) => (
              <article className={styles.demoCard} key={index}>
                {layoutType !== "HEADLINES" && (
                  <div className={styles.demoMedia} aria-hidden="true">
                    <span className={styles.demoImageMark} />
                  </div>
                )}
                <div className={styles.demoContent}>
                  {layoutType === "HEADLINES" && (
                    <span className={styles.headlineNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  <p className={styles.demoTitle}>
                    {PLACEHOLDER_HEADLINES[index]}
                  </p>
                  {layoutType !== "HEADLINES" && (
                    <p className={styles.demoExcerpt}>
                      Aperçu fictif du résumé d’un article récent.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <p className="small text-body-secondary mt-3 mb-0">
          La couleur est utilisée comme accent graphique. La sélection des
          articles réels et leur ordre de publication seront gérés par la page
          d’accueil publique.
        </p>
      </div>
    </section>
  );
}
