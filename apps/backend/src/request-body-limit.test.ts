import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Backend JSON request size configuration", () => {
  it("accepts horoscope JSON and bounded base64 TV icon uploads", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.ts"), "utf8");
    expect(main).toContain("NestFactory.create<NestExpressApplication>");
    expect(main).toMatch(/app\.useBodyParser\(["']json["'],\s*\{\s*limit:\s*["']1\.5mb["']\s*\}\)/);
  });

  it("preserves the existing horoscope upload validation", () => {
    const controller = readFileSync(
      resolve(process.cwd(), "src/horoscopes/horoscope-import.controller.ts"),
      "utf8",
    );
    expect(controller).toContain('typeof input.content!=="string"');
    expect(controller).toContain('return this.imports.importContent(input.content,input.fileName,user.id,"UPLOAD")');
  });
});
