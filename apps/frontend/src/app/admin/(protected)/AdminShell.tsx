"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AdminIcon } from "@/components/admin/AdminIcon";
import { ADMIN_SECTIONS, normalizeAdminSearch } from "./admin-home.data";
import styles from "./admin-shell.module.css";

const STORAGE_KEY = "lmn24-admin-sidebar-collapsed";

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(ADMIN_SECTIONS.map(section => section.id));

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true"); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const setSidebarCollapsed = (next: boolean) => {
    setCollapsed(next);
    try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage unavailable */ }
  };

  const filtered = useMemo(() => ADMIN_SECTIONS.map(section => ({
    ...section,
    features: section.features.filter(feature =>
      !query.trim() || normalizeAdminSearch(feature.title + " " + feature.description + " " + section.title)
        .includes(normalizeAdminSearch(query))),
  })).filter(section => section.features.length), [query]);

  const active = ADMIN_SECTIONS.flatMap(section => section.features)
    .filter(feature => pathname === feature.href || pathname.startsWith(feature.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const isHome = pathname === "/admin";
  const toggleGroup = (id: string) => setOpenGroups(previous =>
    previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);

  return (
    <div className={styles.shell}>
      {mobileOpen && <button type="button" className={styles.scrim}
        aria-label="Fermer le menu d’administration" onClick={() => setMobileOpen(false)} />}
      <aside id="lmn24-admin-navigation" className={[
        styles.sidebar, collapsed ? styles.collapsed : "", mobileOpen ? styles.mobileOpen : "",
      ].join(" ")}>
        <div className={styles.brand}>
          <Link href="/admin" className={styles.brandLink} aria-label="LMN24 — Accueil administration">
            <span className={styles.brandMark}>L</span>
            <span className={styles.brandText}><strong>LMN24</strong><small>Administration</small></span>
          </Link>
          <button type="button" className={styles.collapseButton}
            aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
            title={collapsed ? "Déplier la navigation" : "Replier la navigation"}
            onClick={() => setSidebarCollapsed(!collapsed)}>
            <AdminIcon name={collapsed ? "chevron-right" : "chevron-left"} />
          </button>
        </div>
        <nav className={styles.navigation} aria-label="Navigation de l’administration">
          <Link href="/admin" aria-current={isHome ? "page" : undefined}
            className={isHome ? styles.activeLink : styles.link} title="Accueil">
            <AdminIcon name="bar-chart" /><span className={styles.linkLabel}>Vue d’ensemble</span>
          </Link>
          <div className={styles.search}>
            <label htmlFor="admin-navigation-search" className={styles.visuallyHidden}>Rechercher dans la navigation</label>
            <input id="admin-navigation-search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Rechercher un module…" type="search" />
          </div>
          {filtered.map(section => {
            const expanded = query.trim() !== "" || openGroups.includes(section.id);
            return <div key={section.id} className={styles.group}>
              <button className={styles.groupHeading} type="button" aria-expanded={expanded}
                aria-controls={`admin-nav-group-${section.id}`}
                onClick={() => toggleGroup(section.id)} title={section.title}>
                <AdminIcon name={section.icon} />
                <span className={styles.linkLabel}>{section.title}</span>
                <span className={styles.groupChevron}><AdminIcon name={expanded ? "chevron-left" : "chevron-right"} /></span>
              </button>
              <div id={`admin-nav-group-${section.id}`} className={styles.groupItems}
                hidden={!expanded && !collapsed}>
                {section.features.map(feature => {
                  const selected = pathname === feature.href || pathname.startsWith(feature.href + "/");
                  return <Link key={feature.href} href={feature.href} title={feature.title}
                    aria-current={selected ? "page" : undefined}
                    className={selected ? styles.activeLink : styles.link}>
                    <AdminIcon name={feature.icon} /><span className={styles.linkLabel}>{feature.title}</span>
                  </Link>;
                })}
              </div>
            </div>;
          })}
          {filtered.length === 0 && <p className={styles.noResults}>Aucun module trouvé.</p>}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.link} title="Voir le site public">
            <AdminIcon name="box-arrow-up-right" /><span className={styles.linkLabel}>Voir le site public</span>
          </Link>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={styles.mobileToggle} type="button"
            aria-label="Ouvrir le menu d’administration" aria-controls="lmn24-admin-navigation"
            aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
            <AdminIcon name="list-ul" />
          </button>
          <div className={styles.breadcrumb}>
            <Link href="/admin">Administration</Link>
            {!isHome && <><span aria-hidden="true">/</span><span aria-current="page">{active?.title ?? "Configuration"}</span></>}
          </div>
          <Link className={styles.publicLink} href="/" target="_blank" rel="noopener noreferrer">
            <AdminIcon name="box-arrow-up-right" /> <span>Site public</span>
          </Link>
        </header>
        <div className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}
