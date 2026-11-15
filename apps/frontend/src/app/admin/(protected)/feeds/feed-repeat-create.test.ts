import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync(new URL("./FeedForm.tsx", import.meta.url), "utf8");

describe("Repeat RSS/XML feed creation", () => {
  it("offers an enabled-by-default add-another switch only in create mode", () => {
    expect(form).toContain("const [addAnother, setAddAnother] = useState(true)");
    expect(form).toContain('id="feed-add-another"');
    expect(form).toContain('role="switch"');
    expect(form).toContain('checked={addAnother}');
    expect(form).toContain("Ajouter Nouveau");
    expect(form).toContain('{mode === "create" ? (');
  });

  it("retains only the selected source after successful creation when enabled", () => {
    expect(form).toContain('if (mode === "create" && addAnother)');
    expect(form).toContain("setValues({ ...EMPTY_FEED, sourceId: values.sourceId })");
    expect(form).toContain("setFieldErrors({})");
    expect(form).toContain('setSuccessMessage("Flux RSS/XML enregistré.');
  });

  it("returns to the feed list when add-another is disabled or when editing", () => {
    expect(form).toContain('router.push("/admin/feeds")');
    expect(form).toContain("router.refresh()");
    expect(form).toContain("if (!response.ok)");
  });
});
