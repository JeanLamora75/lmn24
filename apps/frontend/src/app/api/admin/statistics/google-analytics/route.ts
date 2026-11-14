import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getGa4Audience, isGa4Configured } from "@/lib/ga4-data-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };
export async function GET(request: Request): Promise<Response> {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({ message: "Non autorisé." }, { status: 401, headers: noStore });
  if (!isGa4Configured()) {
    return NextResponse.json({ configured: false, message: "Connectez le compte de service GA4 dans la configuration OVH." }, { status: 503, headers: noStore });
  }
  const period = new URL(request.url).searchParams.get("period");
  const days: 7 | 30 = period === "30d" ? 30 : 7;
  try {
    const audience = await getGa4Audience(days);
    return NextResponse.json({ configured: true, ...audience }, { headers: noStore });
  } catch (error) {
    // Never expose authentication secrets, Google response bodies or tokens.
    const code = error instanceof Error && /^GA4_[A-Z_]+$/.test(error.message) ? error.message : "GA4_UNAVAILABLE";
    console.error("[ga4] Data API request failed:", code);
    return NextResponse.json({ configured: true, message: "Statistiques Google Analytics temporairement indisponibles.", code }, { status: 502, headers: noStore });
  }
}
