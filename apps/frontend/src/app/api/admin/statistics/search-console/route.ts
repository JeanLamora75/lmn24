import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getSearchConsoleReport, isSearchConsoleConfigured } from "@/lib/search-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"cache-control":"no-store"};

export async function GET(request: Request): Promise<Response> {
  const user = await getAdminSession();
  if (!user) return NextResponse.json({message:"Non autorisé."},{status:401,headers});
  if (!isSearchConsoleConfigured()) {
    return NextResponse.json({configured:false,message:"Un compte de service Google est nécessaire."},
      {status:503,headers});
  }
  const period = new URL(request.url).searchParams.get("period");
  if (period !== "7d" && period !== "30d") {
    return NextResponse.json({message:"Période invalide."},{status:400,headers});
  }
  try {
    const result = await getSearchConsoleReport(period === "30d" ? 30 : 7);
    return NextResponse.json({configured:true,...result},{headers});
  } catch(error) {
    const code = error instanceof Error && /^GSC_[A-Z_]+$/.test(error.message)
      ? error.message : "GSC_UNAVAILABLE";
    console.error("[search-console] read-only report failed:",code);
    return NextResponse.json({configured:true,code,
      message:code === "GSC_PERMISSION_DENIED"
        ? "Autorisez le compte de service à consulter la propriété dans Google Search Console."
        : "Données Search Console indisponibles. Vérifiez la propriété et l'accès à l'API."},
      {status:502,headers});
  }
}
