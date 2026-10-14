import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";

type Context = { params: Promise<{ segments: string[] }> };
const permitted = new Set(["summary", "runs", "batches", "alerts", "export"]);
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { segments } = await params;
  if (!segments?.length || segments.length > 4 ||
    !segments.every(s => /^[a-zA-Z0-9-]{1,50}$/.test(s)) ||
    !permitted.has(segments[0]!) ||
    (segments.length !== 1 && !(
      segments.length === 3 && segments[0] === "runs" && ["INFOS","VIDEOS"].includes(segments[1]!) ||
      segments.length === 3 && segments[0] === "batches" && segments[2] === "events"
    ))) {
    return NextResponse.json({ message: "Route inconnue." }, { status: 404 });
  }
  const query = new URL(request.url).search;
  try {
    const response = await fetch(getBackendUrl() + "/admin/parser-monitoring/" +
      segments.join("/") + query, {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
        ...(segments[0] === "export" && response.ok
          ? { "content-disposition": "attachment; filename=parser-runs.csv" } : {}),
      },
    });
  } catch {
    return NextResponse.json({ message: "Supervision momentanément indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } });
  }
}
