"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { PHOTO_LABELS } from "@/lib/constants";
import type { Photo } from "@/types/database";

export function PhotoUploader({ roomId, photos }: { roomId: string; photos: Photo[] }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [label, setLabel] = useState<string>("Main angle");

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("label", label);

    const response = await fetch(`/api/rooms/${roomId}/photos`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Photo upload failed.");
    }

    event.target.value = "";
    setIsUploading(false);
    router.refresh();
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
    <div className="grid gap-6">
      <div className="atelier-card grid gap-4 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="atelier-label">Photo intake</p>
            <h2 className="mt-2 font-serif text-2xl">Upload and label room photos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-atelier-charcoal">
              Capture the main angle, each wall, corners, ceiling, floor, and any existing pieces that should stay.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
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

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {PHOTO_LABELS.map((item) => {
            const complete = photos.some((photo) => photo.label === item);
            return (
              <div
                key={item}
                className={`rounded-md border px-3 py-2 text-xs ${
                  complete ? "border-atelier-moss/40 bg-atelier-moss/10 text-atelier-charcoal" : "border-atelier-taupe/25 bg-white/60 text-atelier-taupe"
                }`}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-md border border-dashed border-atelier-taupe/40 p-8 text-center text-sm text-atelier-charcoal">
          Upload room photos to begin your designer diagnosis.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} data-testid={`photo-card-${photo.id}`} className="atelier-card overflow-hidden">
              <img src={photo.file_url} alt={photo.label ?? "Room photo"} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-3 p-3">
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
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-atelier-taupe/30 p-2 text-atelier-charcoal transition hover:bg-atelier-linen"
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
