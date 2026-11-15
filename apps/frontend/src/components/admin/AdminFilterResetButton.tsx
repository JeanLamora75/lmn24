"use client";

import { AdminIcon } from "@/components/admin/AdminIcon";
import { clearAdminSessionFilters } from "@/lib/admin-session-filters";

export function AdminFilterResetButton({ section }: { section: string }) {
  return (
    <div className="d-flex justify-content-end mb-2">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => {
          clearAdminSessionFilters(section);
          // A reload resets every React filter state, including any
          // currently applied server-side pagination and search query.
          window.location.reload();
        }}
      ><AdminIcon name="arrow-counterclockwise" className="me-2 align-middle" /> 
        Réinitialiser les filtres
      </button>
    </div>
  );
}
