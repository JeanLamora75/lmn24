"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ADMIN_SECTIONS, filterAdminSections } from "./admin-home.data";
import styles from "./admin-home.module.css";

export function AdminHomeClient() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const matchedSections = filterAdminSections(ADMIN_SECTIONS, query);
  const hasQuery = query.trim().length > 0;
  const matchCount = matchedSections.reduce((total, section) => total + section.features.length, 0);
  const allCount = ADMIN_SECTIONS.reduce((total, section) => total + section.features.length, 0);

  return (
    <main className="container-fluid px-3 px-lg-5 py-4 py-lg-5">
      <header className={styles.pageHeader}>
        <h1 className="display-6 fw-semibold mb-2">Administration LMN24</h1>
        <p className="text-body-secondary mb-0">
          Retrouvez les outils pour administrer, alimenter et superviser LMN24.
        </p>
      </header>

      <div className={styles.searchPanel} role="search">
        <label htmlFor="admin-feature-search" className="form-label fw-semibold mb-2">
          Rechercher une fonctionnalité
        </label>
        <div className={styles.searchRow}>
          <input
            id="admin-feature-search"
            type="search"
            autoComplete="off"
            className="form-control"
            placeholder="Ex. : vidéo, statistiques, sources, purge…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls="admin-feature-results"
          />
          {hasQuery && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
            >
              Effacer
            </button>
          )}
        </div>
        <p className="small text-body-secondary mb-0 mt-2" aria-live="polite" aria-atomic="true">
          {hasQuery
            ? `${matchCount} fonctionnalité${matchCount > 1 ? "s" : ""} trouvée${matchCount > 1 ? "s" : ""}.`
            : `${allCount} fonctionnalités réparties en ${ADMIN_SECTIONS.length} sections.`}
        </p>
      </div>

      <div id="admin-feature-results" className={styles.sectionList}>
        {matchedSections.length === 0 && (
          <section className="text-center border rounded-4 p-4 p-md-5" role="status">
            <h2 className="h5 mb-2">Aucune fonctionnalité trouvée</h2>
            <p className="text-body-secondary mb-3">
              Essayez un autre mot-clé ou réaffichez toutes les fonctionnalités.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setQuery("")}>
              Réinitialiser la recherche
            </button>
          </section>
        )}

        {matchedSections.map((section) => {
          const panelId = `admin-section-${section.id}`;
          // Searching always reveals matching results; the user's original
          // collapsed state is restored when the search is cleared.
          const expanded = hasQuery || collapsed[section.id] !== true;

          return (
            <section key={section.id} className={styles.section} aria-labelledby={`heading-${section.id}`}>
              <h2 className={styles.sectionHeading} id={`heading-${section.id}`}>
                <button
                  type="button"
                  className={styles.sectionToggle}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  disabled={hasQuery}
                  title={hasQuery ? "La recherche maintient les sections ouvertes" : undefined}
                  onClick={() =>
                    setCollapsed((previous) => ({
                      ...previous,
                      [section.id]: previous[section.id] !== true,
                    }))
                  }
                >
                  <span className={styles.sectionIcon} aria-hidden="true">
                    <Image
                      src={`/bootstrap-icons/${section.icon}.svg`}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                    />
                  </span>
                  <span className={styles.sectionTitle}>{section.title}</span>
                  <span className={styles.sectionCount}>{section.features.length}</span>
                  <span className={`${styles.chevron} ${expanded ? styles.expanded : ""}`} aria-hidden="true" />
                </button>
              </h2>

              <div id={panelId} hidden={!expanded}>
                <div className="row g-3">
                  {section.features.map((feature) => (
                    <div key={feature.href} className="col-12 col-md-6 col-lg-4">
                      <Link
                        href={feature.href}
                        className={styles.cardLink}
                        aria-label={feature.title}
                      >
                        <article className={`card h-100 border-0 shadow-sm ${styles.card}`}>
                          <div className={`card-body ${styles.cardBody}`}>
                            <span className={styles.iconWrapper} aria-hidden="true">
                              <Image
                                src={`/bootstrap-icons/${feature.icon}.svg`}
                                width={40}
                                height={40}
                                alt=""
                                unoptimized
                              />
                            </span>
                            <span className={styles.cardContent}>
                              <h3 className={styles.cardTitle}>{feature.title}</h3>
                              <span className={styles.cardDescription}>{feature.description}</span>
                            </span>
                          </div>
                        </article>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
