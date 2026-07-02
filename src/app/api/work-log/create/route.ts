import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const payload = {
    teacher_profile_id: body.instructorId ?? guard.userId,
    category: body.category,
    content: `${body.title ?? ""}\n${body.content ?? ""}`,
    tagged_student_id: body.taggedStudentId ?? null,
  };
  const { data, error } = await supabaseServer
    .from("teacher_journals")
    .insert(payload)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
