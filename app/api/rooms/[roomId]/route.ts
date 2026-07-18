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

export async function DELETE(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  try {
    const storagePaths = await listStoragePaths(supabase, roomId);
    for (let index = 0; index < storagePaths.length; index += 1000) {
      const { error } = await supabase.storage
        .from("room-photos")
        .remove(storagePaths.slice(index, index + 1000));
      if (error) throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room image cleanup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: deletedRoom, error: deleteError } = await supabase
    .from("rooms")
    .delete()
    .eq("id", roomId)
    .select("id")
    .maybeSingle();

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (!deletedRoom) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const { error: memoryError } = await supabase
    .from("design_memories")
    .delete()
    .eq("scope", "room")
    .eq("scope_id", roomId);

  if (memoryError) {
    console.error("Room deleted, but its scoped design memories could not be removed.", {
      roomId,
      error: memoryError.message
    });
  }

  return NextResponse.json({ ok: true });
}

async function listStoragePaths(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from("room-photos").list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;

    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...(await listStoragePaths(supabase, path)));
    }

    if (!data || data.length < pageSize) break;
  }

  return paths;
}
