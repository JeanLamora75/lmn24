import Link from "next/link";
import styles from "./maintenance-nav.module.css";

const entries = [
  { href: "/admin/import-csv", label: "Import CSV" },
  { href: "/admin/retention", label: "Conservation" },
  { href: "/admin/data-purge", label: "Purge manuelle" },
] as const;

/** Navigation only; does not trigger maintenance operations. */
export function MaintenanceNav({ active }: Readonly<{ active: string }>) {
  return <nav aria-label="Données et maintenance" className={styles.navigation}>
    {entries.map(item => <Link key={item.href} href={item.href}
      aria-current={active === item.href ? "page" : undefined}
      className={active === item.href ? styles.active : styles.link}>
      {item.label}
    </Link>)}
  </nav>;
}
