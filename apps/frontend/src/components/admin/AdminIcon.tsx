import Image from "next/image";

/** Icons bundled with LMN24, sourced from Bootstrap Icons.
 * The allowlist prevents a user-controlled SVG path or arbitrary asset name.
 */
export const ADMIN_ICON_NAMES = [
  "activity", "bar-chart", "box-arrow-up-right", "clock-history",
  "filetype-csv", "gear", "graph-up-arrow", "hash", "newspaper",
  "pencil-square", "play-circle", "plus-circle", "rss", "tags",
  "three-dots-vertical", "toggle-off", "toggle-on", "translate",
  "trash", "youtube", "arrow-clockwise", "arrow-left", "arrow-counterclockwise",
  "search", "floppy", "upload", "download", "eye", "x-circle", "funnel",
  "check-circle", "play-fill", "list-ul",
] as const;
export type AdminIconName = (typeof ADMIN_ICON_NAMES)[number];

export function AdminIcon({
  name,
  size = 16,
  className = "",
}: {
  name: AdminIconName;
  size?: 16 | 18 | 20 | 24;
  className?: string;
}) {
  return (
    <Image
      src={`/bootstrap-icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      unoptimized
      width={size}
      height={size}
      className={`lmn-admin-icon ${className}`.trim()}
    />
  );
}

export function AdminIconButton({
  name,
  label,
  variant = "outline-secondary",
  disabled = false,
  onClick,
}: {
  name: AdminIconName;
  label: string;
  variant?: "outline-secondary" | "outline-primary" | "outline-danger" | "outline-success";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn btn-sm btn-${variant} lmn-admin-icon-button`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <AdminIcon name={name} size={18} />
    </button>
  );
}
