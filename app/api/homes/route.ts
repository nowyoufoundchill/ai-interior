import { NextResponse } from "next/server";
import { SINGLE_HOUSEHOLD_USER_ID } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("homes").select("*").order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ homes: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("homes")
    .insert({ ...body, user_id: SINGLE_HOUSEHOLD_USER_ID })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ home: data }, { status: 201 });
}
