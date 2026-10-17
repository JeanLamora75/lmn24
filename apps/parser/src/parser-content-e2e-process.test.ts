import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "@lmn24/database";
import { ParserEngine } from "./parser-engine.js";
import { VideoParserEngine } from "./video-parser-engine.js";
import { WeatherParserEngine } from "./weather-parser-engine.js";
import { acquireGuardedParserLease } from "./guarded-parser-lease.js";
import { horoscopeImportExecutor, HoroscopeFileMissingError } from "./horoscope-scheduler-adapter.js";

const enabled=process.env.SCHEDULER_PG_INTEGRATION==="1" && !!process.env.DATABASE_URL;
const db=enabled?createPrismaClient():undefined;
const ids={country:randomUUID(),category:randomUUID(),source:randomUUID(),
  feed:randomUUID(),videoFeed:randomUUID(),city:randomUUID()};
const suffix=randomUUID();
const rssUrl="https://fixture.example.test/rss-"+suffix+".xml";
const channel="UC"+"a".repeat(22);
const videoUrl="https://www.youtube.com/feeds/videos.xml?channel_id="+channel;
const articleUrl="https://fixture.example.test/article-"+suffix;
const videoId="abcdefghijk";
const rss=`<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Test</title>
<item><title>LMN24 test item</title><link>${articleUrl}</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate>
<description><![CDATA[<p>Real database smoke</p>]]></description><media:content url="https://fixture.example.test/image.jpg" type="image/jpeg"/></item>
</channel></rss>`;
const atom=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
<title>Fixture channel</title><entry><id>yt:video:${videoId}</id><yt:videoId>${videoId}</yt:videoId>
<yt:channelId>${channel}</yt:channelId><title>Test video</title><published>2026-10-11T12:00:00Z</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg"/></media:group></entry></feed>`;

afterEach(()=>vi.unstubAllGlobals());
afterAll(async()=>{await db?.$disconnect();});
describe.skipIf(!enabled)("real persisted RSS, YouTube, Weather and Horoscope boundary acceptance",()=>{
  it("runs real RSS and YouTube parser engines against isolated PostgreSQL, deduplicating repeat runs",async()=>{
    if(!db)throw new Error("No test database");
    try{
      await db.$executeRaw`INSERT INTO country(id,iso_code2,iso_code3,slug)
        VALUES(${ids.country}::uuid,'FR','FRA',${"fixture-"+suffix})`;
      await db.$executeRaw`INSERT INTO language(iso_code2) VALUES('fr') ON CONFLICT DO NOTHING`;
      await db.$executeRaw`INSERT INTO category(id,slug,display_order)
        VALUES(${ids.category}::uuid,${"fixture-"+suffix},99999)`;
      await db.$executeRaw`INSERT INTO source(id,name,slug,website_url,country_id)
        VALUES(${ids.source}::uuid,'Fixture',${"fixture-"+suffix},'https://fixture.example.test',${ids.country}::uuid)`;
      await db.$executeRaw`INSERT INTO feed(id,source_id,category_id,language_iso_code2,feed_url)
        VALUES(${ids.feed}::uuid,${ids.source}::uuid,${ids.category}::uuid,'fr',${rssUrl})`;
      await db.$executeRaw`INSERT INTO feed_video(id,source_id,category_id,language_iso_code2,channel_id,feed_url)
        VALUES(${ids.videoFeed}::uuid,${ids.source}::uuid,${ids.category}::uuid,'fr',${channel},${videoUrl})`;
      await db.$executeRaw`INSERT INTO setting(key,value,type,scope)
        VALUES('parser.feed_timeout_seconds','5','INTEGER','GLOBAL'),
          ('parser.feed_retry_count','0','INTEGER','GLOBAL')
        ON CONFLICT DO NOTHING`;
      vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
        if(url===rssUrl)return new Response(rss,{status:200});
        if(url===videoUrl)return new Response(atom,{status:200});
        throw new Error("Unexpected fixture URL: "+url);
      }));
      const infos=new ParserEngine(db),videos=new VideoParserEngine(db);
      const infoEvents:Array<{type:string}>=[];
      const lease1=await acquireGuardedParserLease();
      try{
        await infos.run({categoryId:ids.category},event=>infoEvents.push(event),undefined,lease1.signal,lease1.ownerToken);
      }finally{await lease1.release();}
      const lease2=await acquireGuardedParserLease();
      try{
        const result=await videos.run({feedId:ids.videoFeed},undefined,undefined,lease2.signal,lease2.ownerToken);
        expect(result.imported).toBe(1);
      }finally{await lease2.release();}
      expect(infoEvents.some(x=>x.type==="feed-success")).toBe(true);
      expect(await db.article.count({where:{articleUrl}})).toBe(1);
      expect(await db.video.count({where:{feedVideoId:ids.videoFeed}})).toBe(1);
      const lease3=await acquireGuardedParserLease();
      try{
        await infos.run({categoryId:ids.category},()=>{},undefined,lease3.signal,lease3.ownerToken);
        const result=await videos.run({feedId:ids.videoFeed},undefined,undefined,lease3.signal,lease3.ownerToken);
        expect(result.imported).toBe(0);
      }finally{await lease3.release();}
      expect(await db.article.count({where:{articleUrl}})).toBe(1);
      expect(await db.video.count({where:{feedVideoId:ids.videoFeed}})).toBe(1);
    }finally{
      await db.article.deleteMany({where:{sourceId:ids.source}});
      await db.feedRun.deleteMany({where:{feedId:ids.feed}});
      await db.feedVideoRun.deleteMany({where:{feedVideoId:ids.videoFeed}});
      await db.video.deleteMany({where:{feedVideoId:ids.videoFeed}});
      await db.feedVideo.deleteMany({where:{id:ids.videoFeed}});
      await db.feed.deleteMany({where:{id:ids.feed}});
      await db.source.deleteMany({where:{id:ids.source}});
      await db.category.deleteMany({where:{id:ids.category}});
      await db.country.deleteMany({where:{id:ids.country}});
    }
  },60_000);

  it("persists actual weather observations and run SUCCESS through the real engine",async()=>{
    if(!db)throw new Error("No test database");
    await db.$executeRaw`INSERT INTO weather_city(id,slug,name,country_iso2,continent_code,latitude,longitude,timezone,display_order)
      VALUES(${ids.city}::uuid,${"fixture-"+suffix},'Fixture','FR','EU',48.8,2.3,'Europe/Paris',9999)`;
    try{
      const engine=new WeatherParserEngine(db,async()=>[{
        utc_offset_seconds:0,current:{time:Math.floor(Date.now()/1000),
          temperature_2m:20,apparent_temperature:19,relative_humidity_2m:42,
          wind_speed_10m:8,weather_code:1,is_day:1},
      }]);
      const lease=await acquireGuardedParserLease();
      let id:string;
      try{
        id=await engine.start({continentCode:"EU"},"AUTOMATIC",lease);
        await vi.waitFor(async()=>{
          const run=await db.weatherRun.findUnique({where:{id}});
          expect(run?.status).toBe("SUCCESS");
        },{timeout:15000,interval:100});
      }finally{await lease.release();}
      const observation=await db.weatherCurrent.findUnique({where:{cityId:ids.city}});
      expect(observation?.temperatureC.toString()).toBe("20");
    }finally{
      await db.weatherCurrent.deleteMany({where:{cityId:ids.city}});
      await db.weatherCity.deleteMany({where:{id:ids.city}});
    }
  },35_000);

  it("exercises the Horoscope HTTP import adapter with realistic backend replies",async()=>{
    const secret="scheduler-fixture-secret-at-least-32-characters";
    const execute=horoscopeImportExecutor("http://127.0.0.1:3001",secret);
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({status:"SUCCESS"})));
    await expect(execute()).resolves.toEqual({status:"SUCCESS"});
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:404})));
    await expect(execute()).rejects.toBeInstanceOf(HoroscopeFileMissingError);
  });
});
