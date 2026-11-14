import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Backend JSON request size configuration", () => {
  it("raises the JSON body parser limit to one MiB for horoscope uploads", () => {
    const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(main).toMatch(/app\.useBodyParser\(["']json["'],\s*\{\s*limit:\s*["']1mb["']\s*\}\)/);
  });

  it("preserves the existing horoscope upload validation", () => {
    const controller = readFileSync(
      new URL("./horoscopes/horoscope-import.controller.ts", import.meta.url),
      "utf8",
    );
    expect(controller).toContain('typeof input.content!=="string"');
    expect(controller).toContain('return this.imports.importContent(input.content,input.fileName,user.id,"UPLOAD")');
  });
});
