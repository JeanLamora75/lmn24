import { NextResponse } from "next/server";
import { z } from "zod";
import { getBackendUrl } from "@/lib/admin-backend";

const catalogSchema = z.strictObject({
  items: z.array(z.strictObject({
    id: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255),
    displayOrder: z.number().int(),
  })).max(100),
});

/** Only public category identifiers and slugs. No visitor data is sent upstream. */
export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(getBackendUrl() + "/public/categories/catalog", {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("category-catalog-unavailable");
    const parsed = catalogSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("category-catalog-invalid");
    return NextResponse.json(parsed.data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "category-catalog-unavailable" }, { status: 503 });
  }
}
