"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { Photo } from "@/types/database";

const ROOM_PHOTOS_BUCKET = "room-photos";

export async function uploadRoomPhoto(input: { roomId: string; file: File; label: string }): Promise<Photo> {
  if (!input.file.type.startsWith("image/")) throw new Error("Choose an image file for your room photo.");

  const authorizationResponse = await fetch(`/api/rooms/${input.roomId}/photos/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: input.file.name,
      content_type: input.file.type,
      file_size: input.file.size
    })
  });
  const authorization = await authorizationResponse.json().catch(() => ({}));
  if (!authorizationResponse.ok || typeof authorization.storage_path !== "string" || typeof authorization.token !== "string") {
    throw new Error(authorization.error ?? "We couldn't prepare that photo upload. Try again.");
  }

  const supabase = createBrowserSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(ROOM_PHOTOS_BUCKET)
    .uploadToSignedUrl(authorization.storage_path, authorization.token, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false
    });
  if (uploadError) {
    await fetch(`/api/rooms/${input.roomId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "report_signed_upload_failure",
        storage_path: authorization.storage_path,
        content_type: input.file.type,
        file_size: input.file.size,
        error_message: uploadError.message
      })
    }).catch(() => undefined);
    throw new Error(`The photo did not finish uploading. ${uploadError.message}`);
  }

  const finalizeResponse = await fetch(`/api/rooms/${input.roomId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "finalize_signed_upload",
      storage_path: authorization.storage_path,
      label: input.label
    })
  });
  const finalized = await finalizeResponse.json().catch(() => ({}));
  if (!finalizeResponse.ok || !finalized.photo?.id) {
    throw new Error(finalized.error ?? "Your photo uploaded, but we couldn't save it to the room. Try again.");
  }
  return finalized.photo as Photo;
}
