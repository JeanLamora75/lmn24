import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Frontend deployment warning regressions", () => {
  it("uses Next Image for externally hosted video thumbnails without requiring a remote-pattern migration", () => {
    const code = source("../../../components/videos/VideosAdmin.tsx");
    expect(code).toContain('import Image from "next/image"');
    expect(code).toMatch(/<Image unoptimized src=\{video\.thumbnailUrl\}/);
    expect(code).not.toMatch(/<img\b/);
  });

  it("navigates to login with the Next router on an unauthorized weather administration response", () => {
    const code = source("./weather-cities/WeatherCitiesClient.tsx");
    expect(code).toContain('import { useRouter } from "next/navigation"');
    expect(code).toContain('router.replace("/admin/login")');
    expect(code).not.toContain("window.location.assign");
    expect(code).toContain("}, [router]);");
    expect(code).toContain("},[request]);");
  });

  it("keeps the scheduler refresh callback stable across renders and registered in the effect dependencies", () => {
    const code = source("./scheduler/SchedulerSettings.tsx");
    expect(code).toContain("const load = useCallback(async () => {");
    expect(code).toContain("}, [router]);");
    expect(code).toContain("},[load]);");
    expect(code).toContain("await load();");
  });

  it("keeps native radio semantics and exposes validation errors without unsupported aria-invalid", () => {
    const code = source("./categories/CategoryAppearanceForm.tsx");
    expect(code).toContain('type="radio"');
    expect(code).toContain('name="layoutType"');
    expect(code).toContain("fieldErrors.layoutType");
    expect(code).not.toMatch(/aria-invalid=\{Boolean\(fieldErrors\.layoutType\)\}/);
  });
});
