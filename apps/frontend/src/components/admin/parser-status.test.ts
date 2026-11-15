import { describe, expect, it } from "vitest";
import { parserStatusBadge, parserStatusLabel } from "./parser-status";

describe("parser status presentation", () => {
  it("shows understandable French wording for known backend states", () => {
    expect(parserStatusLabel("SUCCESS")).toBe("Réussi");
    expect(parserStatusLabel("RUNNING")).toBe("En cours");
    expect(parserStatusLabel("INTERRUPTED")).toBe("Interrompu");
  });
  it("keeps unexpected backend statuses visible", () => {
    expect(parserStatusLabel("UNKNOWN_STATE")).toBe("UNKNOWN_STATE");
  });
  it("distinguishes failure and progress without assuming missing data is successful", () => {
    expect(parserStatusBadge("ERROR")).toBe("text-bg-danger");
    expect(parserStatusBadge("PARTIAL")).toBe("text-bg-warning");
    expect(parserStatusBadge("RUNNING")).toBe("text-bg-primary");
    expect(parserStatusBadge("UNKNOWN")).toBe("text-bg-secondary");
  });
});
