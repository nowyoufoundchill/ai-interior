"use client";

import Link from "next/link";
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
            className="atelier-card grid overflow-hidden transition-colors duration-300 hover:border-atelier-brass/50"
          >
            <Link href={`/rooms/${room.id}`} className="grid gap-5 p-8 pb-5">
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
              <span className={`atelier-status w-fit ${room.job_status ? "border-atelier-brass/50 text-atelier-brass" : ""}`}>
                {room.job_status ? jobLabel(room.job_status, room.job_type) : statusLabel(room.current_stage || room.status)}
              </span>
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
