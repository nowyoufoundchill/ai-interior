"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ROOM_STATUSES } from "@/lib/constants";
import type { HomeDetail } from "@/lib/data/queries";

type Room = HomeDetail["rooms"][number];

export function RoomList({ initialRooms }: { initialRooms: Room[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  async function deleteRoom(room: Room) {
    if (deletingRoomId) return;
    const confirmed = window.confirm(
      `Delete “${room.name}”? This permanently removes the room, its photos, designs, and room plan.`
    );
    if (!confirmed) return;

    setDeletingRoomId(room.id);
    try {
      const response = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(payload.error ?? "Could not delete the room.");
        return;
      }
      setRooms((current) => current.filter((candidate) => candidate.id !== room.id));
      router.refresh();
    } finally {
      setDeletingRoomId(null);
    }
  }

  if (rooms.length === 0) {
    return <div className="atelier-empty">The first room begins the home.</div>;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => {
        const deleting = deletingRoomId === room.id;
        return (
          <article
            key={room.id}
            data-testid={`room-card-${room.id}`}
            data-lifecycle-state={room.lifecycle_state}
            data-display-render-id={room.display_render_id ?? "source"}
            data-display-kind={room.design_image_url ? "design" : room.source_photo_url ? "source" : "empty"}
            className="atelier-card grid overflow-hidden transition-colors duration-300 hover:border-atelier-brass/50"
          >
            <Link href={`/rooms/${room.id}`} className="grid" aria-label={`${room.name}: ${room.next_action ?? "Open room"}`}>
              {room.display_image_url ? (
                <div className="relative aspect-[4/3] overflow-hidden border-b border-hairline bg-atelier-sand/30">
                  <Image
                    src={room.display_image_url}
                    alt={room.design_image_url ? `Latest design for ${room.name}` : `Source photo for ${room.name}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                  <span className="absolute bottom-3 left-3 bg-atelier-charcoal/90 px-3 py-1.5 text-[9px] font-medium uppercase tracking-label text-atelier-ivory">
                    {room.design_image_url ? "Latest design" : "Room photo"}
                  </span>
                </div>
              ) : (
                <div className="grid aspect-[4/3] place-items-center border-b border-hairline bg-atelier-paper px-8 text-center font-serif text-lg italic text-atelier-fawn">
                  One photograph begins this room.
                </div>
              )}
              <div className="grid gap-5 p-8 pb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="atelier-label">{room.room_type || "Room"}</p>
                  <h3 className="mt-2 font-serif text-2xl text-atelier-ink">{room.name}</h3>
                </div>
                <span aria-hidden="true" className="font-serif text-xl text-atelier-taupe">→</span>
              </div>
              <p className="text-sm font-light leading-7 text-atelier-umber">
                {room.purpose || "Add a purpose and design brief."}
              </p>
              <div className="flex items-center justify-between gap-4">
                <span data-testid={`room-state-${room.id}`} className={`atelier-status w-fit ${room.lifecycle_state === "needs_attention" ? "border-atelier-clay/50 text-atelier-clay" : room.lifecycle_state === "working" || room.lifecycle_state === "kept" || room.lifecycle_state === "implementation_ready" ? "border-atelier-brass/50 text-atelier-brass" : ""}`}>
                  {room.lifecycle_label ?? (room.job_status ? jobLabel(room.job_status, room.job_type) : statusLabel(room.current_stage || room.status))}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-label text-atelier-ink">
                  {room.next_action ?? "Open room"} <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
              </div>
            </Link>
            <div className="mt-auto flex justify-end border-t border-hairline px-8 py-4">
              <button
                type="button"
                data-testid={`room-delete-button-${room.id}`}
                onClick={() => deleteRoom(room)}
                disabled={Boolean(deletingRoomId)}
                aria-label={`Delete ${room.name}`}
                className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-label text-atelier-clay transition-opacity duration-300 hover:opacity-70 disabled:cursor-wait disabled:opacity-40"
              >
                <Trash2 aria-hidden="true" size={14} strokeWidth={1.5} />
                {deleting ? "Deleting…" : "Delete room"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function statusLabel(status: string) {
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status;
}

function jobLabel(status: string, type: string | null | undefined) {
  const noun = type === "batch_render" ? "Perspectives" : type === "chat_action" ? "Requested change" : type === "diagnosis" ? "Room reading" : type === "render" ? "Visualization" : "Design step";
  return status === "retryable_failed" || status === "terminal_failed" ? `${noun} needs attention` : `${noun} in progress`;
}
