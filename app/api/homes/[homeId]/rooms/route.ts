import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...body, home_id: homeId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}
