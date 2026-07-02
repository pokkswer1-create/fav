import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("expenses")
    .insert({
      category: body.category,
      amount: Number(body.amount),
      expense_date: body.date ?? new Date().toISOString().slice(0, 10),
      note: body.description ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
