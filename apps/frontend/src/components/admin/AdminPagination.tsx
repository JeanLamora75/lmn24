import { AdminIcon } from "./AdminIcon";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
  position?: "supérieure" | "inférieure";
};

/** Shared compact pagination for all admin lists. All actions stay keyboard-accessible. */
export function AdminPagination({
  page, totalPages, onPageChange, label, position = "inférieure",
}: Readonly<Props>) {
  if (totalPages <= 1) return null;
  const current = Math.min(totalPages, Math.max(1, page));
  const pages: Array<number | "left" | "right"> = [];
  if (totalPages <= 7) {
    for (let n = 1; n <= totalPages; n += 1) pages.push(n);
  } else {
  const first = Math.max(2, current - 1);
  const last = Math.min(totalPages - 1, current + 1);
  pages.push(1);
  if (first > 2) pages.push("left");
  for (let n = first; n <= last; n += 1) pages.push(n);
  if (last < totalPages - 1) pages.push("right");
  if (totalPages > 1) pages.push(totalPages);
  }
  const move = (target: number) => onPageChange(Math.max(1, Math.min(totalPages, target)));
  return (
    <nav aria-label={`Pagination ${position} des ${label}`}
      className="lmn-admin-pagination">
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${current <= 1 ? "disabled" : ""}`}>
          <button type="button" className="page-link" aria-label="Première page"
            disabled={current <= 1} onClick={() => move(1)}>
            <AdminIcon name="chevron-double-left" />
          </button>
        </li>
        <li className={`page-item ${current <= 1 ? "disabled" : ""}`}>
          <button type="button" className="page-link" aria-label="Page précédente"
            disabled={current <= 1} onClick={() => move(current - 1)}>
            <AdminIcon name="chevron-left" />
          </button>
        </li>
        {pages.map(item => typeof item === "number" ? (
          <li className={`page-item ${item === current ? "active" : ""}`} key={item}>
            <button type="button" className="page-link"
              aria-label={`Page ${item}`}
              aria-current={item === current ? "page" : undefined}
              onClick={() => move(item)}>{item}</button>
          </li>
        ) : <li key={item} className="page-item disabled">
          <span className="page-link" aria-hidden="true">…</span>
        </li>)}
        <li className={`page-item ${current >= totalPages ? "disabled" : ""}`}>
          <button type="button" className="page-link" aria-label="Page suivante"
            disabled={current >= totalPages} onClick={() => move(current + 1)}>
            <AdminIcon name="chevron-right" />
          </button>
        </li>
        <li className={`page-item ${current >= totalPages ? "disabled" : ""}`}>
          <button type="button" className="page-link" aria-label="Dernière page"
            disabled={current >= totalPages} onClick={() => move(totalPages)}>
            <AdminIcon name="chevron-double-right" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
