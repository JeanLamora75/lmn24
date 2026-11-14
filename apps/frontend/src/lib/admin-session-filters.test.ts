import { describe, expect, it, vi, afterEach } from "vitest";
import { adminFilterStorageKey, clearAdminSessionFilters, readStoredFilter } from "./admin-session-filters";

afterEach(() => vi.unstubAllGlobals());

describe("admin filter session persistence", () => {
  it("isolates filter keys for each administration page and field", () => {
    expect(adminFilterStorageKey("sources", "status")).not.toBe(adminFilterStorageKey("feeds", "status"));
    expect(adminFilterStorageKey("sources", "page")).not.toBe(adminFilterStorageKey("sources", "status"));
  });

  it("restores valid values and ignores corrupted or unsafe persisted filters", () => {
    expect(readStoredFilter(JSON.stringify("active"), "all")).toBe("active");
    expect(readStoredFilter("25", 10)).toBe(25);
    expect(readStoredFilter("true", false)).toBe(true);
    expect(readStoredFilter("{invalid", "all")).toBe("all");
    expect(readStoredFilter('"x"', 10)).toBe(10);
    expect(readStoredFilter("-12", 1)).toBe(1);
    expect(readStoredFilter("100000", 10)).toBe(10);
    expect(readStoredFilter(JSON.stringify("x".repeat(600)), "")).toBe("");
  });

  it("clears only admin filter keys on a successful login and leaves unrelated session data alone", () => {
    const store = new Map<string, string>([
      [adminFilterStorageKey("sources", "status"), '"active"'],
      [adminFilterStorageKey("feeds", "page"), "3"],
      ["other-feature", "untouched"],
    ]);
    vi.stubGlobal("window", { sessionStorage: {
      get length() { return store.size; },
      key(index: number) { return [...store.keys()][index] ?? null; },
      removeItem(key: string) { store.delete(key); },
    } });
    clearAdminSessionFilters();
    expect(store.has(adminFilterStorageKey("sources", "status"))).toBe(false);
    expect(store.has(adminFilterStorageKey("feeds", "page"))).toBe(false);
    expect(store.get("other-feature")).toBe("untouched");
  });
});
