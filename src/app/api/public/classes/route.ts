import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const DAY_KO: Record<string, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

function formatDays(days: string[] | null): string {
  if (!days?.length) return "";
  return days.map((d) => DAY_KO[d] ?? d).join("/");
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "regular";
  try {
    const supabase = getSupabaseServer();
    let query = supabase
      .from("classes")
      .select("id, name, days_of_week, start_time, end_time, monthly_fee, capacity, makeup_capacity, class_type, class_status")
      .eq("class_status", "active");

    if (type === "regular") {
      query = query.eq("class_type", "regular");
    } else if (type === "trial") {
      query = query.eq("class_type", "trial");
    } else if (type === "makeup_available") {
      query = query.gt("makeup_capacity", 0);
    }

    const { data, error } = await query.order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      dayOfWeek: formatDays(row.days_of_week as string[]),
      startTime: row.start_time,
      endTime: row.end_time,
      monthlyFee: row.monthly_fee,
      makeupCapacity: row.makeup_capacity ?? 0,
      classType: row.class_type,
    }));

    return NextResponse.json(list);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
