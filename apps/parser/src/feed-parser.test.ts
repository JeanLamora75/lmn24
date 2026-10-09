import { describe, expect, it } from "vitest";

import { cleanHtml, parseFeedXml } from "./feed-parser.js";

describe("feed parser", () => {
  it("cleans html summaries", () => {
    expect(
      cleanHtml("<p>Hello <strong>world</strong>&nbsp;&amp; all</p>"),
    ).toBe("Hello world & all");
  });

  it("parses RSS items and requires an image", async () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Test</title>
          <item>
            <title>Valid article</title>
            <link>https://example.com/article-1</link>
            <pubDate>Thu, 09 Oct 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<p>Summary</p>]]></description>
            <media:content url="https://example.com/image.jpg" type="image/jpeg" />
          </item>
          <item>
            <title>No image</title>
            <link>https://example.com/article-2</link>
            <pubDate>Thu, 09 Oct 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const result = await parseFeedXml(xml, "https://example.com/feed.xml");

    expect(result.itemsFound).toBe(2);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.articleUrl).toBe(
      "https://example.com/article-1",
    );
    expect(result.articles[0]?.summary).toBe("Summary");
  });

  it("uses Atom updated as a date fallback", async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Test</title>
        <entry>
          <title>Atom article</title>
          <link href="https://example.com/atom-1" />
          <updated>2026-10-09T10:00:00Z</updated>
          <summary><![CDATA[<p>Atom summary</p><img src="https://example.com/atom.jpg" />]]></summary>
        </entry>
      </feed>`;

    const result = await parseFeedXml(xml, "https://example.com/atom.xml");

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.imageUrl).toBe(
      "https://example.com/atom.jpg",
    );
  });
});
