import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ICON_NAMES } from "./AdminIcon";

describe("LMN24 administration Bootstrap icon catalog", () => {
  it("contains distinct names with a real bundled SVG for each one", () => {
    expect(new Set(ADMIN_ICON_NAMES).size).toBe(ADMIN_ICON_NAMES.length);
    for (const name of ADMIN_ICON_NAMES) {
      const file = resolve(process.cwd(), "public/bootstrap-icons", name + ".svg");
      expect(existsSync(file), name).toBe(true);
      expect(readFileSync(file, "utf8")).toMatch(/<svg\b/);
    }
  });

  it("keeps the critical action icons available", () => {
    for (const name of ["pencil-square", "trash", "plus-circle", "arrow-clockwise", "search", "floppy", "upload", "download", "arrow-left"]) {
      expect(ADMIN_ICON_NAMES).toContain(name);
    }
  });
});
