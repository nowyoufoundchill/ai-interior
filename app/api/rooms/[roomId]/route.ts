import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ room: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("rooms").update(body).eq("id", roomId).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data });
}
