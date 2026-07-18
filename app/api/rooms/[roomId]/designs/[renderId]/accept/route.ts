import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ roomId: string; renderId: string }> }) {
  const { roomId, renderId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: candidate, error } = await supabase.from("renders").select("id, source_photo_id").eq("id", renderId).eq("room_id", roomId).eq("status", "candidate").maybeSingle();
  if (error || !candidate) return NextResponse.json({ error: "That design is no longer available to keep." }, { status: 404 });

  if (candidate.source_photo_id) {
    await supabase.from("renders").update({ status: "historical" }).eq("room_id", roomId).eq("source_photo_id", candidate.source_photo_id).eq("status", "accepted");
  }
  const { error: acceptError } = await supabase.from("renders").update({ status: "accepted" }).eq("id", candidate.id).eq("room_id", roomId);
  if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 500 });
  await supabase.from("rooms").update({ status: "approved", current_stage: "approved" }).eq("id", roomId);
  return NextResponse.json({ ok: true });
}
