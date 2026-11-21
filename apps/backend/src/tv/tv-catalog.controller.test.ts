import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { TvCatalogService } from "./tv-catalog.service";
import { TvCatalogController } from "./tv-catalog.controller";

const request = { headers: { cookie: "lmn24_session=test-session" } };
const admin = { id: "x", email: "admin@example.invalid", role: "ADMIN", firstName: null, lastName: null };
function setup(role: "ADMIN" | "EDITOR" | null, enabled = true) {
  const getUserFromSession = vi.fn().mockResolvedValue(role ? { ...admin, role } : null);
  const listCountries = vi.fn().mockResolvedValue([]);
  const listChannels = vi.fn().mockResolvedValue([]);
  const upsertCountry = vi.fn().mockResolvedValue({ countryId: "x" });
  const discoverChannel = vi.fn().mockResolvedValue({ channelId: "y" });
  const updateAssociation = vi.fn().mockResolvedValue({ id: "x" });
  const addVariant = vi.fn().mockResolvedValue({ variantId: "x" });
  const auth = { getUserFromSession } as unknown as AuthService;
  const service = { listCountries, listChannels, upsertCountry, discoverChannel, updateAssociation, addVariant } as unknown as TvCatalogService;
  const config = { get: (key: string) => key === "TV_CATALOG_ADMIN_ENABLED" ? (enabled ? "true" : "false") : undefined } as unknown as ConfigService;
  return { controller: new TvCatalogController(auth, service, config), getUserFromSession, listCountries, upsertCountry, discoverChannel };
}
describe("SCRUM-115 TV catalogue ADMIN authorization", () => {
  it("rejects unauthenticated requests before touching tables", async () => {
    const s = setup(null);
    await expect(s.controller.listCountries(request)).rejects.toMatchObject({ status: 401 });
    expect(s.listCountries).not.toHaveBeenCalled();
  });
  it("rejects non-admin users before touching tables", async () => {
    const s = setup("EDITOR");
    await expect(s.controller.listCountries(request)).rejects.toMatchObject({ status: 403 });
    expect(s.listCountries).not.toHaveBeenCalled();
  });
  it("keeps all admin catalogue operations disabled by default", async () => {
    const s = setup("ADMIN", false);
    await expect(s.controller.listCountries(request)).rejects.toMatchObject({ status: 503 });
    expect(s.listCountries).not.toHaveBeenCalled();
  });
  it("permits an explicitly enabled administrator", async () => {
    const s = setup("ADMIN");
    await expect(s.controller.listCountries(request)).resolves.toEqual({ items: [] });
    expect(s.listCountries).toHaveBeenCalledOnce();
  });
  it("rejects invalid timezones and unsafe links before writes", async () => {
    const s = setup("ADMIN");
    const id = "a1000000-0000-4000-8000-000000000001";
    await expect(s.controller.upsertCountry(request, id, { referenceTimezone: "Invalid/Zone", isActive: true }))
      .rejects.toMatchObject({ status: 400 });
    await expect(s.controller.discoverChannel(request, {
      countryId: id, slug: "example", name: "Example", websiteUrl: "javascript:alert(1)",
    })).rejects.toMatchObject({ status: 400 });
    expect(s.upsertCountry).not.toHaveBeenCalled();
    expect(s.discoverChannel).not.toHaveBeenCalled();
  });
  it("rejects an active association with no national number", async () => {
    const s = setup("ADMIN");
    await expect(s.controller.updateAssociation(request, "a3000000-0000-4000-8000-000000000001", {
      isActive: true, needsReview: false, manualNumber: null,
      officialNumber: null, assignedNumber: null, defaultVariantId: null,
    })).rejects.toMatchObject({ status: 400 });
  });
 it("SCRUM-122 passes optimistic version token and respects ADMIN gate",async()=>{
  const s=setup("ADMIN");
  const id="a1000000-0000-4000-8000-000000000001";
  const version="2026-11-21 08:00:00.123456+00";
  await s.controller.upsertCountry(request,id,{referenceTimezone:"Europe/Paris",
   isActive:false,expectedVersion:version});
  expect(s.upsertCountry).toHaveBeenCalledWith(id,"Europe/Paris",false,version);
 });

});
