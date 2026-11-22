import {describe,expect,it} from "vitest";
import {approvedExternalUrl,safeTvProgrammeImageUrl} from "./tv-detail-model";

describe("TV programme detail image URL handling",()=>{
 it("accepts the same HTTP and HTTPS programme images as guide cards",()=>{
  expect(safeTvProgrammeImageUrl("http://example.com/poster.jpg")).toBe("http://example.com/poster.jpg");
  expect(safeTvProgrammeImageUrl("https://example.com/poster.jpg")).toBe("https://example.com/poster.jpg");
  expect(safeTvProgrammeImageUrl("/tv-icons/poster.jpg")).toBe("/tv-icons/poster.jpg");
 });
 it("rejects unsafe schemes, embedded credentials, and invalid relative paths",()=>{
  expect(safeTvProgrammeImageUrl("javascript:alert(1)")).toBeNull();
  expect(safeTvProgrammeImageUrl("data:image/svg+xml,test")).toBeNull();
  expect(safeTvProgrammeImageUrl("https://user:pass@example.com/a.jpg")).toBeNull();
  expect(safeTvProgrammeImageUrl("/private/file.jpg")).toBeNull();
 });
 it("does not loosen the existing HTTPS-only validation used for other URLs",()=>{
  expect(approvedExternalUrl("http://example.com/")).toBeNull();
 });
});
