import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./statistics-workspace.module.css";

const sections = [
  { href: "/admin/site-statistics", label: "Statistiques LMN24" },
  { href: "/admin/site-statistics/google-analytics", label: "Google Analytics" },
  { href: "/admin/site-statistics/search-console", label: "Search Console" },
] as const;

export function StatisticsWorkspaceHeader({
  title, description, active, actions,
}: Readonly<{ title: string; description: string; active: string; actions?: ReactNode }>) {
  return <>
    <header className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>Analyse et audience</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    <nav className={styles.tabs} aria-label="Sources de statistiques">
      {sections.map(item => <Link key={item.href} href={item.href}
        className={active === item.href ? styles.activeTab : styles.tab}
        aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  </>;
}

export function StatisticsFilterPanel({ children, title = "Filtres et période" }: Readonly<{ children: ReactNode; title?: string }>) {
  return <section className={styles.filters} aria-label={title}>
    <div className={styles.filterTitle}>{title}</div>
    {children}
  </section>;
}

export function StatisticsDataPanel({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={`${styles.dataSurface} ${className}`}>{children}</div>;
}
