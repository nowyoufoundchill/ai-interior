import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const memoryId = typeof body.memory_id === "string" ? body.memory_id : null;
  const content = typeof body.content === "object" && body.content !== null ? body.content : null;

  if (!memoryId || !content) {
    return NextResponse.json({ error: "Memory id and content are required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("design_memories")
    .select("*")
    .eq("id", memoryId)
    .eq("scope", "room")
    .eq("scope_id", roomId)
    .single();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 404 });

  const { data, error } = await supabase
    .from("design_memories")
    .update({ content })
    .eq("id", memoryId)
    .eq("scope", "room")
    .eq("scope_id", roomId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("revisions").insert({
    room_id: roomId,
    user_message: "Memory edited",
    assistant_response: "Updated a saved design memory.",
    revision_type: "memory_update",
    state_before: { memory: existing } as Json,
    state_after: { memory: data } as Json
  });
  return NextResponse.json({ memory: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const memoryId = typeof body.memory_id === "string" ? body.memory_id : null;

  if (!memoryId) {
    return NextResponse.json({ error: "Memory id is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("design_memories")
    .select("*")
    .eq("id", memoryId)
    .eq("scope", "room")
    .eq("scope_id", roomId)
    .single();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 404 });

  const { error } = await supabase
    .from("design_memories")
    .delete()
    .eq("id", memoryId)
    .eq("scope", "room")
    .eq("scope_id", roomId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("revisions").insert({
    room_id: roomId,
    user_message: "Memory deleted",
    assistant_response: "Deleted a saved design memory.",
    revision_type: "memory_update",
    state_before: { memory: existing } as Json,
    state_after: { deleted_memory_id: memoryId } as Json
  });
  return NextResponse.json({ ok: true });
}
