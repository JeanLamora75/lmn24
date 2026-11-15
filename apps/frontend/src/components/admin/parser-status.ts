/** Human-readable parser statuses; unknown backend statuses remain visible. */
export function parserStatusLabel(status: string): string {
  switch (status.trim().toUpperCase()) {
    case "ALL": return "Tous les statuts";
    case "SUCCESS": return "Réussi";
    case "RUNNING": return "En cours";
    case "ERROR": return "Erreur";
    case "PARTIAL": return "Partiel";
    case "INTERRUPTED": return "Interrompu";
    case "PENDING": return "En attente";
    default: return status;
  }
}

export function parserStatusBadge(status: string): string {
  switch (status.trim().toUpperCase()) {
    case "SUCCESS": return "text-bg-success";
    case "ERROR": return "text-bg-danger";
    case "PARTIAL": return "text-bg-warning";
    case "RUNNING": return "text-bg-primary";
    default: return "text-bg-secondary";
  }
}
