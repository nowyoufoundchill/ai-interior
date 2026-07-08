import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["style", "color", "material", "avoid", "constraint", "preference"] as const;

export async function GET(_: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("design_preferences")
    .select("*")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const preferenceType = typeof body.preference_type === "string" ? body.preference_type : "preference";

  if (!label) {
    return NextResponse.json({ error: "A preference label is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(preferenceType as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "Unknown preference type." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: homeMeta } = await supabase.from("homes").select("test_run_id").eq("id", homeId).maybeSingle();
  const { data, error } = await supabase
    .from("design_preferences")
    .insert({
      home_id: homeId,
      preference_type: preferenceType,
      label,
      details: typeof body.details === "object" && body.details !== null ? body.details : {},
      test_run_id: homeMeta?.test_run_id ?? null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preference: data });
}
