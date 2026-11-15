import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const navigation = load("./MaintenanceNav.tsx");
const csv = load("../../app/admin/(protected)/import-csv/page.tsx");
const purge = load("../../app/admin/(protected)/data-purge/ManualPurgeScreen.tsx");
const retention = load("../../app/admin/(protected)/retention/RetentionSettings.tsx");

describe("lot 5 — safe administrative maintenance", () => {
  it("keeps maintenance navigation distinct from destructive operations", () => {
    for (const path of ["/admin/import-csv", "/admin/retention", "/admin/data-purge"]) {
      expect(navigation).toContain(path);
    }
    expect(navigation).toContain('aria-current={active === item.href ? "page" : undefined}');
    for (const page of [csv, purge, retention]) expect(page).toContain("<MaintenanceNav");
  });
  it("requires an explicit review and opt-in before writing imported CSV data", () => {
    expect(csv).toContain("const [confirmedImport, setConfirmedImport] = useState(false)");
    expect(csv).toContain("!selectedFile || !analysis || !confirmedImport");
    expect(csv).toContain("disabled={importing || analyzing || !confirmedImport}");
    expect(csv).toContain("setConfirmedImport(false)");
    expect(csv).toContain('type="checkbox"');
    expect(csv).toContain('"/api/admin/import-csv/" + analysis.kind + "/import"');
  });
  it("keeps preview tokens, expiry and typed confirmation for destructive purge", () => {
    expect(purge).toContain('"/api/admin/manual-purge/preview?"');
    expect(purge).toContain('"/api/admin/manual-purge/execute"');
    expect(purge).toContain("if (mode === \"all\" && typed !== table) return;");
    expect(purge).toContain("Date.now() > new Date(preview.expiresAt).getTime()");
    expect(purge).toContain("preview.table !== table || preview.mode !== mode");
    expect(purge).toContain("confirmed: true");
    expect(purge).toContain("!confirm || activeJob || launching");
  });
  it("retains a deliberate confirmation for retention decreases", () => {
    expect(retention).toContain("if (isDecrease && !window.confirm(");
    expect(retention).toContain("confirmDecrease: isDecrease");
    expect(retention).toContain("expectedDays: previous");
  });
});
