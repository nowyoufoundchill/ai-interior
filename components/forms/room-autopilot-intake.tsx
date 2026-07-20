"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadRoomPhoto } from "@/lib/storage/room-photo-upload";

export function RoomAutopilotIntake({ homeId }: { homeId: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [uploadedPhotoId, setUploadedPhotoId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0] ?? null;
    if (selectedPhoto && !selectedPhoto.type.startsWith("image/")) {
      event.target.value = "";
      setPhoto(null);
      setError("Choose an image file for your room photo.");
      return;
    }

    setPhoto(selectedPhoto);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const outcome = String(form.get("outcome") ?? "").trim();
    const roomName = String(form.get("room_name") ?? "").trim();

    if (!photo || !outcome) {
      setError("Add one room photo and tell us what you want the room to do better.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let roomId = createdRoomId;
      if (!roomId) {
        const roomResponse = await fetch(`/api/homes/${homeId}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roomName || "My room",
            purpose: outcome,
            design_brief: outcome,
            status: "intake",
            current_stage: "empty"
          })
        });
        const roomPayload = await roomResponse.json().catch(() => ({}));
        if (!roomResponse.ok || !roomPayload.room?.id) throw new Error(roomPayload.error ?? "We could not save this room.");
        roomId = roomPayload.room.id;
        setCreatedRoomId(roomId);
      }

      if (!roomId) throw new Error("We could not save this room.");
      let photoId = uploadedPhotoId;
      if (!photoId) {
        const uploaded = await uploadRoomPhoto({ roomId, file: photo, label: "Main angle" });
        photoId = uploaded.id;
        setUploadedPhotoId(photoId);
      }
      const designResponse = await fetch(`/api/rooms/${roomId}/first-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_photo_id: photoId })
      });
      if (!designResponse.ok) {
        const designPayload = await designResponse.json().catch(() => ({}));
        throw new Error(designPayload.error ?? "Your room is saved, but we couldn't start its design.");
      }
      router.push(`/rooms/${roomId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not start this room.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8" aria-busy={isSubmitting} aria-describedby={error ? "autopilot-intake-error" : undefined}>
      <label className="grid gap-2">
        <span className="atelier-label">Your room photo</span>
        <input data-testid="autopilot-photo-input" type="file" accept="image/*" className="atelier-field" onChange={selectPhoto} disabled={isSubmitting} />
        <span className="text-sm font-light text-atelier-umber">One clear, wide view is enough to begin.</span>
      </label>
      <label className="grid gap-2">
        <span className="atelier-label">What should this room do better?</span>
        <textarea data-testid="autopilot-outcome-input" name="outcome" required rows={4} className="atelier-field" placeholder="Make this a calm family room that feels finished and works for everyday evenings." disabled={isSubmitting || Boolean(createdRoomId)} />
      </label>
      <label className="grid gap-2">
        <span className="atelier-label">Room name <span className="normal-case tracking-normal text-atelier-taupe">(optional)</span></span>
        <input data-testid="autopilot-room-name-input" name="room_name" className="atelier-field" placeholder="Living room" disabled={isSubmitting || Boolean(createdRoomId)} />
      </label>
      {error ? <p id="autopilot-intake-error" role="alert" className="text-sm text-atelier-clay">{error}</p> : null}
      <p role="status" aria-live="polite" className="sr-only">{isSubmitting ? "Saving your room and starting its design." : ""}</p>
      <button data-testid="autopilot-intake-submit" type="submit" className="atelier-btn w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Starting your room" : "Design my room"}
      </button>
    </form>
  );
}
