import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const ROOM_PHOTOS_BUCKET = "room-photos";
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const fileName = typeof body.file_name === "string" ? body.file_name.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim().toLowerCase() : "";
  const fileSize = typeof body.file_size === "number" ? body.file_size : Number.NaN;

  if (!fileName || !contentType.startsWith("image/") || !Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "Choose a valid room photo." }, { status: 400 });
  }
  if (fileSize > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Choose a room photo smaller than 50 MB." }, { status: 413 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("id, test_run_id").eq("id", roomId).maybeSingle();
  if (roomError || !room) {
    console.error("[photo-upload-url] room lookup failed", { roomId, error: roomError?.message ?? "not found" });
    return NextResponse.json({ error: "We couldn't find this room." }, { status: 404 });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-").slice(-160) || "room-photo";
  const storagePath = room.test_run_id
    ? `test-runs/${room.test_run_id}/${roomId}-${crypto.randomUUID()}-${safeName}`
    : `${roomId}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage.from(ROOM_PHOTOS_BUCKET).createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[photo-upload-url] signing failed", { roomId, storagePath, error: error?.message ?? "no signed upload data" });
    return NextResponse.json({ error: "We couldn't prepare that photo upload. Try again." }, { status: 500 });
  }

  return NextResponse.json({ storage_path: data.path, token: data.token });
}
