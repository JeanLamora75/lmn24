import type { ReactNode } from "react";
import "./admin-workspace.css";

/** Presentation-only wrappers: retain all existing filtering and form behavior. */
export function AdminFilterPanel({ children, title = "Filtres et recherche" }: Readonly<{ children: ReactNode; title?: string }>) {
  return <section className="lmn-admin-filter-panel" aria-label={title}>
    <div className="lmn-admin-filter-heading">{title}</div>
    {children}
  </section>;
}

export function AdminDataPanel({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return <section className="lmn-admin-table-surface" aria-label={label}>{children}</section>;
}

export function AdminPageHeading({ title, description, actions }: Readonly<{
  title: ReactNode; description: string; actions?: ReactNode;
}>) {
  return <header className="lmn-admin-page-header">
    <div><h1>{title}</h1><p className="mb-0">{description}</p></div>
    {actions}
  </header>;
}
