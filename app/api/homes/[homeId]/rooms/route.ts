import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data: home, error: homeError } = await supabase.from("homes").select("id, test_run_id").eq("id", homeId).maybeSingle();
  if (homeError || !home) return NextResponse.json({ error: "We couldn't find this home." }, { status: 404 });
  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...body, home_id: homeId, test_run_id: home.test_run_id ?? null })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}
