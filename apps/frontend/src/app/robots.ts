import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/_next/", "/source-media/"] },
    ],
    sitemap: "https://www.lmn24.com/sitemap.xml",
    host: "https://www.lmn24.com",
  };
}
