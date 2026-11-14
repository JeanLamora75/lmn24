import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGa4Audience } from "./ga4-data-api";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GA4_SERVICE_ACCOUNT_JSON_B64;
  delete process.env.GA4_PROPERTY_ID;
});

describe("GA4 Data API connection", () => {
  it("refuses calls without a configured service account", async () => {
    delete process.env.GA4_SERVICE_ACCOUNT_JSON_B64;
    await expect(getGa4Audience(7)).rejects.toThrow("GA4_NOT_CONFIGURED");
  });

  it("authenticates with a short-lived JWT then reads the specified property", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const credentials = {
      type: "service_account",
      client_email: "reader@example-project.iam.gserviceaccount.com",
      private_key: privateKey.export({type:"pkcs8",format:"pem"}).toString(),
    };
    process.env.GA4_SERVICE_ACCOUNT_JSON_B64 = Buffer.from(JSON.stringify(credentials)).toString("base64");
    process.env.GA4_PROPERTY_ID = "391719478";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push(input);
      if (input.includes("oauth2.googleapis.com/token")) {
        expect(String(init?.body)).toContain("grant_type=");
        return {ok:true,json:async()=>({access_token:"test-token",expires_in:3600})};
      }
      expect(init?.headers).toMatchObject({authorization:"Bearer test-token"});
      const payload = JSON.parse(String(init?.body)) as {metrics:{name:string}[],dimensions?:{name:string}[]};
      if (!payload.dimensions?.length) return {ok:true,json:async()=>({rows:[{metricValues:[{value:"105"},{value:"130"},{value:"220"}]}]})};
      return {ok:true,json:async()=>({rows:[{dimensionValues:[{value:payload.dimensions![0]!.name === "date" ? "20261114" : "France"}],metricValues:[{value:"42"}]}]})};
    }));
    const report = await getGa4Audience(7);
    expect(report).toMatchObject({propertyId:"391719478",activeUsers:105,sessions:130,screenPageViews:220});
    expect(report.daily).toEqual([{name:"20261114",value:42}]);
    expect(calls).toHaveLength(5);
    expect(calls.filter(x=>x.includes("analyticsdata.googleapis.com/v1beta/properties/391719478:runReport"))).toHaveLength(4);
  });
});
