import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localizedCategoryHref, localizedSourceHref } from "./home-data";

const card = readFileSync(new URL("./HomeSection.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../public/PublicFooter.tsx", import.meta.url), "utf8");
const footerStyle = readFileSync(new URL("../public/PublicFooter.module.css", import.meta.url), "utf8");
const breadcrumbs = readFileSync(new URL("../seo/PublicBreadcrumbs.tsx", import.meta.url), "utf8");

describe("SCRUM-99 crawlable internal navigation", () => {
  it("creates localized canonical links only for valid public source profiles", () => {
    for (const locale of ["fr","en","de","es","pt","it","ru","nl"]) {
      expect(localizedSourceHref(locale,"le-monde")).toBe("/"+locale+"/source/le-monde");
      expect(localizedCategoryHref(locale,"international")).toBe("/"+locale+"/category/international");
    }
    expect(localizedSourceHref("xx","le-monde")).toBeNull();
    expect(localizedSourceHref("fr","../admin")).toBeNull();
    expect(localizedSourceHref("fr",undefined)).toBeNull();
  });
  it("keeps independent internal source links outside external article anchors", () => {
    expect(card).toContain("const sourceHref = localizedSourceHref(locale, article.source.slug)");
    expect(card).toContain("<Link href={sourceHref} className={styles.sourceDirectoryLink}>");
    expect(card.indexOf("      {sourceHref && (")).toBeGreaterThan(card.indexOf('className={styles.articleLink}>{content}</div>'));
  });
  it("preserves server-rendered category links in the mobile footer", () => {
    expect(footer).toContain('className="row g-4"');
    expect(footer).toContain('href={`/category/${category}`}');
    expect(footerStyle).not.toContain("display: none;");
    expect(footerStyle).toContain("width: 50%");
  });
  it("uses semantic breadcrumb navigation and real HTML anchors", () => {
    expect(breadcrumbs).toContain('<nav aria-label={label}');
    expect(breadcrumbs).toContain("<ol");
    expect(breadcrumbs).toContain("<Link href={item.href}");
    expect(breadcrumbs).toContain('aria-current="page"');
  });
});
