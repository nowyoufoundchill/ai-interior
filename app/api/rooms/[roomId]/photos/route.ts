import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

const ROOM_PHOTOS_BUCKET = "room-photos";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServiceSupabaseClient();
  const contentType = request.headers.get("content-type") ?? "";
  const { data: roomMeta } = await supabase.from("rooms").select("test_run_id").eq("id", roomId).maybeSingle();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = stringFormValue(formData.get("label")) ?? "Room photo";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A photo file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Choose an image file for your room photo." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
    const storagePath = `${roomId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(ROOM_PHOTOS_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false
    });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicUrlData } = supabase.storage.from(ROOM_PHOTOS_BUCKET).getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("photos")
      .insert({
        room_id: roomId,
        storage_path: storagePath,
        file_url: publicUrlData.publicUrl,
        label,
        angle_type: label,
        test_run_id: roomMeta?.test_run_id ?? null
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from(ROOM_PHOTOS_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await staleCurrentDiagnosis(supabase, roomId);
    await supabase.from("rooms").update({ status: "photos" }).eq("id", roomId);
    return NextResponse.json({ photo: data }, { status: 201 });
  }

  const body = await request.json();
  const expectedSignedPathPrefix = roomMeta?.test_run_id
    ? `test-runs/${roomMeta.test_run_id}/${roomId}-`
    : `${roomId}/`;

  if (body.operation === "report_signed_upload_failure") {
    const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
    if (!storagePath.startsWith(expectedSignedPathPrefix) || storagePath.includes("..")) {
      return NextResponse.json({ error: "That photo upload does not belong to this room." }, { status: 400 });
    }
    console.error("[photo-signed-upload] browser upload failed", {
      roomId,
      storagePath,
      contentType: typeof body.content_type === "string" ? body.content_type.slice(0, 100) : "unknown",
      fileSize: typeof body.file_size === "number" ? body.file_size : null,
      error: typeof body.error_message === "string" ? body.error_message.slice(0, 500) : "unknown storage error"
    });
    return new Response(null, { status: 204 });
  }

  if (body.operation === "finalize_signed_upload") {
    const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Room photo";
    if (!storagePath.startsWith(expectedSignedPathPrefix) || storagePath.includes("..")) {
      return NextResponse.json({ error: "That photo upload does not belong to this room." }, { status: 400 });
    }

    const { data: object, error: objectError } = await supabase.storage.from(ROOM_PHOTOS_BUCKET).info(storagePath);
    if (objectError || !object || !object.size) {
      console.error("[photo-finalize] uploaded object missing", { roomId, storagePath, error: objectError?.message ?? "empty object" });
      return NextResponse.json({ error: "The photo did not finish uploading. Try again." }, { status: 409 });
    }

    const { data: publicUrlData } = supabase.storage.from(ROOM_PHOTOS_BUCKET).getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from("photos")
      .insert({
        room_id: roomId,
        storage_path: storagePath,
        file_url: publicUrlData.publicUrl,
        label,
        angle_type: label,
        test_run_id: roomMeta?.test_run_id ?? null
      })
      .select("*")
      .single();

    if (error) {
      console.error("[photo-finalize] photo row insert failed", { roomId, storagePath, error: error.message });
      await supabase.storage.from(ROOM_PHOTOS_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "The photo uploaded, but we couldn't save it to the room. Try again." }, { status: 500 });
    }

    await staleCurrentDiagnosis(supabase, roomId);
    await supabase.from("rooms").update({ status: "photos" }).eq("id", roomId);
    return NextResponse.json({ photo: data }, { status: 201 });
  }

  const { data, error } = await supabase
    .from("photos")
    .insert({ ...body, room_id: roomId, test_run_id: roomMeta?.test_run_id ?? null })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await staleCurrentDiagnosis(supabase, roomId);
  await supabase.from("rooms").update({ status: "photos" }).eq("id", roomId);
  return NextResponse.json({ photo: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const photoId = typeof body.photo_id === "string" ? body.photo_id : null;
  const label = typeof body.label === "string" ? body.label : null;

  if (!photoId || !label) {
    return NextResponse.json({ error: "Photo id and label are required." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("photos")
    .update({ label, angle_type: label })
    .eq("id", photoId)
    .eq("room_id", roomId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = await request.json();
  const photoId = typeof body.photo_id === "string" ? body.photo_id : null;
  const storagePath = typeof body.storage_path === "string" ? body.storage_path : null;

  if (!photoId || !storagePath) {
    return NextResponse.json({ error: "Photo id and storage path are required." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { error: removeError } = await supabase.storage.from(ROOM_PHOTOS_BUCKET).remove([storagePath]);
  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });

  const { error } = await supabase.from("photos").delete().eq("id", photoId).eq("room_id", roomId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await staleCurrentDiagnosis(supabase, roomId);
  return NextResponse.json({ ok: true });
}

function stringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * PRD v3 §4 invalidation rule: new/changed photos mark the current diagnosis
 * stale (kept, not deleted) so the owner knows to re-run it. Nothing else is
 * touched here — concepts/products/renders only go stale when the diagnosis
 * or mood board is actually re-run/re-locked, not merely on photo changes.
 */
async function staleCurrentDiagnosis(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  roomId: string
) {
  await supabase.from("room_analyses").update({ status: "stale" }).eq("room_id", roomId).eq("status", "current");
}
