"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AdminIcon, type AdminIconName } from "@/components/admin/AdminIcon";
import { ADMIN_SECTIONS, normalizeAdminSearch } from "./admin-home.data";
import styles from "./admin-shell.module.css";
import "./admin-accessibility.css";

const STORAGE_KEY = "lmn24-admin-sidebar-collapsed";

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lastMobileOpen = useRef(false);
  const [openGroups, setOpenGroups] = useState<string[]>(ADMIN_SECTIONS.map(section => section.id));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true"); } catch { /* storage unavailable */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      if (lastMobileOpen.current) toggleRef.current?.focus();
      lastMobileOpen.current = false;
      return;
    }
    lastMobileOpen.current = true;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      sidebarRef.current?.querySelector<HTMLButtonElement>("[data-admin-close]")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      const items = Array.from(sidebar.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled])',
      )).filter(item => item.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 991px)");
    const onViewportChange = () => {
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", onViewportChange);
    return () => media.removeEventListener("change", onViewportChange);
  }, []);

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
    <div className={styles.shell + " lmn24-admin-shell"}>
      <a className="lmn-admin-skip-link" href="#lmn24-admin-main">Aller au contenu principal</a>
      {mobileOpen && <button type="button" className={styles.scrim}
        aria-label="Fermer le menu d’administration" onClick={() => setMobileOpen(false)} />}
      <aside ref={sidebarRef} id="lmn24-admin-navigation" className={[
        styles.sidebar, collapsed ? styles.collapsed : "", mobileOpen ? styles.mobileOpen : "",
      ].join(" ")}>
        <div className={styles.brand}>
          <button data-admin-close type="button" className={styles.mobileClose}
            aria-label="Fermer la navigation" onClick={() => setMobileOpen(false)}>
            <AdminIcon name="x-circle" />
          </button>
          <Link href="/admin" onClick={() => setMobileOpen(false)} className={styles.brandLink} aria-label="LMN24 — Accueil administration">
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
          <Link href="/admin" onClick={() => setMobileOpen(false)} aria-label="Vue d’ensemble" aria-current={isHome ? "page" : undefined}
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
              <button className={styles.groupHeading} type="button" aria-expanded={collapsed && !mobileOpen ? true : expanded}
                aria-label={section.title}
                aria-controls={`admin-nav-group-${section.id}`}
                onClick={() => toggleGroup(section.id)} title={section.title}>
                <AdminIcon name={section.icon as AdminIconName} />
                <span className={styles.linkLabel}>{section.title}</span>
                <span className={styles.groupChevron}><AdminIcon name={expanded ? "chevron-left" : "chevron-right"} /></span>
              </button>
              <div id={`admin-nav-group-${section.id}`} className={styles.groupItems}
                hidden={!expanded && (!collapsed || mobileOpen)}>
                {section.features.map(feature => {
                  const selected = pathname === feature.href || pathname.startsWith(feature.href + "/");
                  return <Link key={feature.href} href={feature.href} onClick={() => setMobileOpen(false)} title={feature.title} aria-label={feature.title}
                    aria-current={selected ? "page" : undefined}
                    className={selected ? styles.activeLink : styles.link}>
                    <AdminIcon name={feature.icon as AdminIconName} /><span className={styles.linkLabel}>{feature.title}</span>
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
          <button ref={toggleRef} className={styles.mobileToggle} type="button"
            aria-label={mobileOpen ? "Fermer le menu d’administration" : "Ouvrir le menu d’administration"} aria-controls="lmn24-admin-navigation"
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
        <div id="lmn24-admin-main" tabIndex={-1} className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}
