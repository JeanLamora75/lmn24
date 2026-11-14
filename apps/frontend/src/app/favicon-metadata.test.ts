import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logo = new URL("../../public/logo_lmn24.png", import.meta.url);
const publicLayout = new URL("./[locale]/layout.tsx", import.meta.url);
const adminLayout = new URL("./admin/layout.tsx", import.meta.url);

describe("Official LMN24 favicon", () => {
  it("has a non-empty official logo asset", () => {
    const png = readFileSync(logo);
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  });

  it.each([
    ["localized public pages", publicLayout],
    ["administration pages", adminLayout],
  ])("uses the same favicon on %s", (_label, file) => {
    const layout = readFileSync(file, "utf8");
    expect(layout).toContain('icons: { icon: [{ url: "/logo_lmn24.png"');
    expect(layout).toContain('shortcut: "/logo_lmn24.png"');
    expect(layout).toContain('apple: "/logo_lmn24.png"');
  });
});
