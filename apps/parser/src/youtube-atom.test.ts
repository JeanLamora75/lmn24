import { describe, expect, it } from "vitest";
import { parseYouTubeAtom } from "./youtube-atom.js";

const channel = "UC" + "A".repeat(22);
const sample = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
<title>Example Channel</title><id>yt:channel:${channel}</id>
<entry><id>yt:video:abcdefghijk</id><yt:videoId>abcdefghijk</yt:videoId><yt:channelId>${channel}</yt:channelId>
<title>Une vidéo d'actualité</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
<published>2026-10-10T12:00:00+00:00</published><updated>2026-10-10T13:00:00+00:00</updated>
<media:group><media:title>Une vidéo d'actualité</media:title><media:description>Résumé vidéo</media:description><media:thumbnail url="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" width="480" height="360"/></media:group>
</entry></feed>`;
describe("SCRUM-40 YouTube Atom", () => {
  it("extracts video metadata without downloading any video", async () => {
    const result=await parseYouTubeAtom(sample,channel);
    expect(result.itemsFound).toBe(1);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({ platformVideoId:"abcdefghijk",videoUrl:"https://www.youtube.com/watch?v=abcdefghijk" });
    expect(result.videos[0]?.publishedAt.toISOString()).toBe("2026-10-10T12:00:00.000Z");
  });
  it("rejects a video claiming a different channel", async () => {
    const result=await parseYouTubeAtom(sample.replace("<yt:channelId>"+channel+"</yt:channelId>","<yt:channelId>UC"+"B".repeat(22)+"</yt:channelId>"),channel);
    expect(result.videos).toHaveLength(0);
  });
});
