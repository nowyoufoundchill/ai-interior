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

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = stringFormValue(formData.get("label")) ?? "Room photo";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A photo file is required." }, { status: 400 });
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
        angle_type: label
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from(ROOM_PHOTOS_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("rooms").update({ status: "photos" }).eq("id", roomId);
    return NextResponse.json({ photo: data }, { status: 201 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("photos")
    .insert({ ...body, room_id: roomId })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({ ok: true });
}

function stringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
