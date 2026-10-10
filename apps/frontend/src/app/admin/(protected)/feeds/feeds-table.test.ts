import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const table = readFileSync(new URL("./FeedsTable.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./FeedDeleteDialog.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./feeds.module.css", import.meta.url), "utf8");

describe("SCRUM-20 — tableau des flux et dernier FeedRun", () => {
  it("affiche les cinq colonnes et le dernier statut du même run", () => {
    for (const header of [
      "Dernière utilisation", "Dernière durée", "Items trouvés",
      "Items enregistrés", "Dernier statut",
    ]) expect(table).toContain(header);
    expect(table).toContain("lastRunDate(feed.lastRun?.startedAt ?? null)");
    expect(table).toContain("lastRunDuration(feed.lastRun?.durationMs ?? null)");
    expect(table).toContain('feed.lastRun?.itemsFound ?? "—"');
    expect(table).toContain('feed.lastRun?.articlesImported ?? "—"');
    expect(table).toContain('colSpan={11}');
  });

  it("affiche SUCCESS en vert, ERROR en rouge avec message au survol et au clavier", () => {
    expect(table).toContain('feed.lastRun?.status === "ERROR"');
    expect(table).toContain('feed.lastRun?.status === "SUCCESS"');
    expect(table).toContain("title={lastRunErrorMessage(feed.lastRun)}");
    expect(table).toContain('aria-label={"Erreur : " + lastRunErrorMessage(feed.lastRun)}');
    expect(table).toContain("tabIndex={0}");
    expect(styles).toContain(".lastStatusSuccess {");
    expect(styles).toContain("color: #0f5132");
    expect(styles).toContain(".lastStatusError {");
    expect(styles).toContain("color: #842029");
  });

  it("ajoute la corbeille après le crayon sur desktop et Supprimer dans le menu mobile", () => {
    const edit = table.indexOf("/bootstrap-icons/pencil-square.svg");
    const trash = table.indexOf("/bootstrap-icons/trash.svg");
    expect(trash).toBeGreaterThan(edit);
    expect(table).toContain("onClick={() => setDeleteTarget(feed)}");
    expect(table).toContain('className="dropdown-item text-danger"');
    expect(table).toContain("<FeedDeleteDialog");
  });
});

describe("SCRUM-20 — confirmation obligatoire", () => {
  it("présente le nombre réel d'historiques et le maintien des articles", () => {
    expect(dialog).toContain('"/delete-impact"');
    expect(dialog).toContain("feedRuns");
    expect(dialog).toContain("Les articles déjà enregistrés seront conservés.");
    expect(dialog).toContain("disabled={loading || feedRuns === null || deleting}");
  });

  it("n'exécute DELETE que sur confirmation, jamais sur annulation", () => {
    expect(dialog).toContain('method: "DELETE"');
    expect(dialog).toContain("onClick={() => void confirmDelete()}");
    expect(dialog).toContain('onClick={() => dialogRef.current?.close()}');
    expect(dialog).toContain("deletingRef.current");
  });
});
