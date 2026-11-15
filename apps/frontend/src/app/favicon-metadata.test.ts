import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logo = new URL("../../public/logo_lmn24.png", import.meta.url);
const favicon = new URL("../../public/favicon.ico", import.meta.url);
const publicLayout = new URL("./[locale]/layout.tsx", import.meta.url);
const adminLayout = new URL("./admin/layout.tsx", import.meta.url);

describe("Official LMN24 favicon", () => {
  it("preserves the original official PNG logo", () => {
    const png = readFileSync(logo);
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  });

  it("serves a valid multi-resolution Windows favicon at the public root", () => {
    const ico = readFileSync(favicon);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3);
    expect(ico.byteLength).toBeGreaterThan(100);
    const imageSizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
      const width = ico[6 + i * 16] || 256;
      const height = ico[7 + i * 16] || 256;
      return `${width}x${height}`;
    });
    for (const size of ["16x16", "32x32", "48x48"]) {
      expect(imageSizes).toContain(size);
    }
  });

  it.each([
    ["localized public pages", publicLayout],
    ["administration pages", adminLayout],
  ])("uses the ICO favicon and preserves the PNG apple-touch icon on %s", (_label, file) => {
    const layout = readFileSync(file, "utf8");
    expect(layout).toContain('icons: { icon: [{ url: "/favicon.ico"');
    expect(layout).toContain('shortcut: "/favicon.ico"');
    expect(layout).toContain('apple: "/logo_lmn24.png"');
  });
});
