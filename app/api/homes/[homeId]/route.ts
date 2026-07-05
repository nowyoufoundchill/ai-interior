import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("homes").select("*, rooms(*)").eq("id", homeId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ home: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("homes").update(body).eq("id", homeId).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ home: data });
}
