import { describe, expect, it } from "vitest";
import { adminPaginationItems } from "./admin-pagination-pages";

describe("admin pagination shared behavior", () => {
  it("shows all small page sets without an ellipsis", () => {
    expect(adminPaginationItems(2, 4)).toEqual([1, 2, 3, 4]);
    expect(adminPaginationItems(1, 1)).toEqual([1]);
    expect(adminPaginationItems(1, 0)).toEqual([]);
  });
  it("keeps first, nearby and last pages accessible", () => {
    expect(adminPaginationItems(5, 20)).toEqual([1, "left", 4, 5, 6, "right", 20]);
  });
  it("handles boundaries and out-of-range page values", () => {
    expect(adminPaginationItems(1, 20)).toEqual([1, 2, "right", 20]);
    expect(adminPaginationItems(20, 20)).toEqual([1, "left", 19, 20]);
    expect(adminPaginationItems(-8, 20)).toEqual(adminPaginationItems(1, 20));
    expect(adminPaginationItems(99, 20)).toEqual(adminPaginationItems(20, 20));
  });
});
