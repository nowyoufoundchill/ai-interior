import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ homeId: string; preferenceId: string }> }) {
  const { homeId, preferenceId } = await params;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("design_preferences")
    .delete()
    .eq("id", preferenceId)
    .eq("home_id", homeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
