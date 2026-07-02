import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate, endDate가 필요합니다." }, { status: 400 });
  }
  const supabaseServer = getSupabaseServer();

  const [{ data: registrations }, { data: attendance }, { data: routes }] = await Promise.all([
    supabaseServer
      .from("shuttle_registrations")
      .select("id, shuttle_route_id, student_name")
      .eq("status", "active"),
    supabaseServer
      .from("shuttle_attendance")
      .select("registration_id, has_boarded, date")
      .gte("date", startDate)
      .lte("date", endDate),
    supabaseServer.from("shuttle_routes").select("id, class_name, day_of_week"),
  ]);

  const routeNameMap = new Map((routes ?? []).map((r) => [r.id, `${r.day_of_week} ${r.class_name}`]));
  const regRouteMap = new Map((registrations ?? []).map((r) => [r.id, r.shuttle_route_id]));
  const routeStatsMap = new Map<
    string,
    { routeId: string; routeName: string; totalRegistered: number; totalBoarded: number; recordCount: number }
  >();

  for (const reg of registrations ?? []) {
    const routeId = reg.shuttle_route_id;
    if (!routeStatsMap.has(routeId)) {
      routeStatsMap.set(routeId, {
        routeId,
        routeName: routeNameMap.get(routeId) ?? "노선",
        totalRegistered: 0,
        totalBoarded: 0,
        recordCount: 0,
      });
    }
    routeStatsMap.get(routeId)!.totalRegistered += 1;
  }

  for (const row of attendance ?? []) {
    const routeId = regRouteMap.get(row.registration_id);
    if (!routeId) continue;
    if (!routeStatsMap.has(routeId)) continue;
    const item = routeStatsMap.get(routeId)!;
    item.recordCount += 1;
    if (row.has_boarded) item.totalBoarded += 1;
  }

  const routeStats = Array.from(routeStatsMap.values()).map((item) => ({
    ...item,
    avgBoarded: item.recordCount ? Number((item.totalBoarded / item.recordCount).toFixed(2)) : 0,
    boardingRate: item.recordCount ? Number(((item.totalBoarded / item.recordCount) * 100).toFixed(1)) : 0,
  }));

  const totalBoarded = routeStats.reduce((s, r) => s + r.totalBoarded, 0);
  const totalRecorded = routeStats.reduce((s, r) => s + r.recordCount, 0);
  const totalDays = new Set((attendance ?? []).map((a) => a.date)).size;
  const stats = {
    totalBoarded,
    boardingRate: totalRecorded ? Number(((totalBoarded / totalRecorded) * 100).toFixed(1)) : 0,
    avgBoarded: totalDays ? Number((totalBoarded / totalDays).toFixed(2)) : 0,
    totalDays,
  };

  return NextResponse.json({ stats, routeStats });
}
