"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_LABELS } from "@/lib/constants";
import type { Photo } from "@/types/database";
import { uploadRoomPhoto } from "@/lib/storage/room-photo-upload";

export function PhotoUploader({ roomId, photos }: { roomId: string; photos: Photo[] }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [label, setLabel] = useState<string>("Main angle");

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadRoomPhoto({ roomId, file, label });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      event.target.value = "";
      setIsUploading(false);
      router.refresh();
    }
  }

  async function updateLabel(photoId: string, nextLabel: string) {
    const response = await fetch(`/api/rooms/${roomId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId, label: nextLabel })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Photo label update failed.");
    }

    router.refresh();
  }

  async function deletePhoto(photo: Photo) {
    const response = await fetch(`/api/rooms/${roomId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photo.id, storage_path: photo.storage_path })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Photo delete failed.");
    }

    router.refresh();
  }

  return (
    <div className="grid gap-10">
      <div className="grid gap-6 border-t border-hairline pt-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="atelier-eyebrow">Photo intake</p>
            <h2 className="mt-3 font-serif text-3xl text-atelier-ink">
              Begin with <em className="italic">photographs</em>
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-light leading-7 text-atelier-umber">
              The main angle, each wall, corners, ceiling, floor, and any existing pieces that
              should stay.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              data-testid="photo-upload-label-select"
              className="atelier-field min-w-44"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            >
              {PHOTO_LABELS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className={`atelier-btn ${isUploading ? "pointer-events-none opacity-40" : ""}`}>
              {isUploading ? "Uploading" : "Add photo"}
              <input
                data-testid="photo-upload-input"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={uploadPhoto}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-5">
          {PHOTO_LABELS.map((item) => {
            const complete = photos.some((photo) => photo.label === item);
            return (
              <div
                key={item}
                className={`border px-3 py-2.5 text-[10px] font-medium uppercase tracking-label ${
                  complete
                    ? "border-atelier-brass/50 bg-atelier-ivory text-atelier-brass"
                    : "border-hairline bg-atelier-paper text-atelier-taupe"
                }`}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="atelier-empty">One photograph begins the room.</div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} data-testid={`photo-card-${photo.id}`} className="atelier-card atelier-hover-img overflow-hidden">
              <img src={photo.file_url} alt={photo.label ?? "Room photo"} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-3 border-t border-hairline p-4">
                <select
                  data-testid={`photo-label-select-${photo.id}`}
                  className="atelier-field"
                  value={photo.label ?? ""}
                  onChange={(event) => updateLabel(photo.id, event.target.value)}
                >
                  {PHOTO_LABELS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid={`photo-delete-button-${photo.id}`}
                  onClick={() => deletePhoto(photo)}
                  className="flex min-h-11 min-w-11 items-center justify-center border border-hairline text-sm text-atelier-umber transition-colors duration-300 hover:border-atelier-clay/50 hover:text-atelier-clay"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
