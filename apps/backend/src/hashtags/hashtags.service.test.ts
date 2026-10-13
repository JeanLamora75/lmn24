import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagsService } from "./hashtags.service";

const id = "11111111-1111-4111-8111-111111111111";
const base = {
  name: "Moscou",
  slug: "moscou",
  isActive: true,
  aliases: [{ name: "Moscow", languageIsoCode2: "en" }],
};

function service(prisma: unknown) {
  return new HashtagsService({ prisma } as DatabaseService);
}

describe("SCRUM-49 — Hashtag administration", () => {
  it("saves canonical aliases and does not duplicate the main name", async () => {
    const create = vi.fn().mockResolvedValue({ id });
    const findUnique = vi.fn().mockResolvedValue({
      id, name: "Moscou", slug: "moscou", isActive: true,
      aliases: [], _count: { hourlyCounts: 0 },
    });
    await service({ hashtag: { create, findUnique } }).create(base);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        aliases: {
          create: [{ name: "Moscow", normalizedName: "moscow", languageIsoCode2: "en" }],
        },
      }),
    }));
  });

  it("rejects duplicate aliases or aliases equivalent to the main name", async () => {
    const api = service({});
    await expect(api.create({ ...base, aliases: [{ name: "MOSCOU" }] }))
      .rejects.toThrow(BadRequestException);
    await expect(api.create({ ...base, aliases: [{ name: "Moscow" }, { name: "MOSCOW" }] }))
      .rejects.toThrow(BadRequestException);
  });

  it("returns a useful conflict for a duplicate slug", async () => {
    const error = Object.assign(new Error("duplicate"), { code: "P2002" });
    const api = service({ hashtag: { create: vi.fn().mockRejectedValue(error) } });
    await expect(api.create(base)).rejects.toThrow(ConflictException);
  });

  it("lists only the requested status with server-side pagination", async () => {
    const count = vi.fn().mockResolvedValue(42);
    const findMany = vi.fn().mockResolvedValue([]);
    const api = service({ hashtag: { count, findMany } });
    await expect(api.list({ status: "active", page: 2, pageSize: 10 }))
      .resolves.toMatchObject({ pagination: { page: 2, total: 42, totalPages: 5 } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true }, take: 10, skip: 10,
    }));
  });

  it("updates main fields and aliases atomically", async () => {
    const actions: string[] = [];
    const tx = {
      hashtag: { update: vi.fn(async () => { actions.push("update"); }) },
      hashtagAlias: {
        deleteMany: vi.fn(async () => { actions.push("delete"); }),
        createMany: vi.fn(async () => { actions.push("create"); }),
      },
    };
    type Transaction = typeof tx;
    const prisma = {
      hashtag: { findUnique: vi.fn().mockResolvedValue({
        id, name: "Moscou", slug: "moscou", isActive: true,
        aliases: [], _count: { hourlyCounts: 0 },
      }) },
      $transaction: vi.fn(async (callback: (transaction: Transaction) => Promise<void>) => callback(tx)),
    };
    await service(prisma).update(id, base);
    expect(actions).toEqual(["update", "delete", "create"]);
  });

  it("deletes only the hashtag and relies on FK cascade for dependents", async () => {
    const api = service({
      hashtag: {
        findUnique: vi.fn().mockResolvedValue({
          id, name: "Moscou", aliases: [{ id: "alias" }],
          _count: { hourlyCounts: 5 },
        }),
        delete: vi.fn().mockResolvedValue({ id }),
      },
    });
    await expect(api.delete(id)).resolves.toEqual({
      deleted: true, aliasCount: 1, hourlyCountRows: 5,
    });
  });

  it("does not update a nonexistent hashtag", async () => {
    await expect(service({ hashtag: { findUnique: vi.fn().mockResolvedValue(null) } })
      .setActive(id, false)).rejects.toThrow(NotFoundException);
  });

  it("detects an exact normalized overlap and warns about short terms", async () => {
    const api = service({
      hashtag: { findMany: vi.fn().mockResolvedValue([{
        name: "Moscow City", aliases: [{ name: "MOSCOW" }],
      }]) },
    });
    const warnings = await api.getWarnings({
      ...base, aliases: [{ name: "Moscow" }, { name: "NY" }],
    });
    expect(warnings.join(" ")).toContain("Moscow City");
    expect(warnings.join(" ")).toContain("Termes courts");
  });
});
