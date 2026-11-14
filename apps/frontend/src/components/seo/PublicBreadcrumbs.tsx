import Link from "next/link";

type Crumb = { label: string; href?: string };

export function PublicBreadcrumbs({ items, label }: { items: readonly Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="py-3">
      <ol className="d-flex flex-wrap align-items-center gap-2 list-unstyled mb-0 small">
        {items.map((item, index) => (
          <li key={index} className="d-flex align-items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="text-body-secondary">/</span> : null}
            {item.href
              ? <Link href={item.href} className="text-decoration-none">{item.label}</Link>
              : <span aria-current="page" className="text-body-secondary">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
