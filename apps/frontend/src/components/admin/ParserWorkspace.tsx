import Link from "next/link";
import type { ReactNode } from "react";
import { AdminIcon } from "@/components/admin/AdminIcon";
import styles from "./parser-workspace.module.css";

const ROUTES = [
  { href: "/admin/parser", label: "Parser Infos" },
  { href: "/admin/video-parser", label: "Parser Vidéos" },
  { href: "/admin/weather-parser", label: "Parser Météo" },
  { href: "/admin/parser-monitoring", label: "Supervision" },
] as const;

export function ParserWorkspaceHeader({
  title, description, active, actions,
}: Readonly<{ title: string; description: string; active: string; actions?: ReactNode }>) {
  return <>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Collecte et supervision</p>
        <h1 className="h2 mb-1">{title}</h1>
        <p className="text-body-secondary mb-0">{description}</p>
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
    <nav aria-label="Navigation des parsers" className={styles.nav}>
      {ROUTES.map(item => <Link key={item.href} href={item.href}
        aria-current={active === item.href ? "page" : undefined}
        className={active === item.href ? styles.current : styles.navLink}>{item.label}</Link>)}
    </nav>
  </>;
}

export function ParserCriteriaPanel({
  title = "Critères de lancement", children, id,
}: Readonly<{ title?: string; children: ReactNode; id: string }>) {
  return <section className={styles.criteria} aria-labelledby={id}>
    <div className={styles.sectionHeading}><AdminIcon name="funnel" />
      <h2 id={id} className="h5 mb-0">{title}</h2></div>
    <div className={styles.criteriaBody}>{children}</div>
  </section>;
}

export function ParserSection({
  title, id, children, actions, className = "",
}: Readonly<{ title: string; id: string; children: ReactNode; actions?: ReactNode; className?: string }>) {
  return <section className={`${styles.section} ${className}`} aria-labelledby={id}>
    <div className={styles.sectionHeading}><h2 id={id} className="h5 mb-0">{title}</h2>{actions}</div>
    <div className={styles.sectionBody}>{children}</div>
  </section>;
}
