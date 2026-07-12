export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PreferencesManager } from "@/components/homes/preferences-manager";
import { ROOM_STATUSES } from "@/lib/constants";
import { getDesignPreferences, getHome } from "@/lib/data/queries";

export default async function HomeDetailPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const home = await getHome(homeId).catch(() => null);

  if (!home) notFound();

  const rooms = Array.isArray(home.rooms) ? home.rooms : [];
  const preferences = await getDesignPreferences(homeId).catch(() => []);

  return (
    <AppShell>
      <div className="atelier-rise grid gap-20">
        <section className="grid gap-10 border-b border-hairline pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div>
            <p className="atelier-eyebrow">{home.region || home.home_type || "Home"}</p>
            <h1 className="mt-3 font-serif text-5xl leading-tight text-atelier-ink md:text-6xl">{home.name}</h1>
            <p className="mt-6 max-w-3xl text-sm font-light leading-7 text-atelier-umber">
              {home.style_notes || "Add whole-home style notes to keep each room connected."}
            </p>
          </div>
          <div className="grid gap-6 self-end">
            <div className="border-t border-hairline pt-4">
              <p className="atelier-label">Whole-home palette</p>
              <p className="mt-2 text-sm font-light leading-7 text-atelier-umber">{jsonList(home.whole_home_palette)}</p>
            </div>
            <div className="border-t border-hairline pt-4">
              <p className="atelier-label">Constraints</p>
              <p className="mt-2 text-sm font-light leading-7 text-atelier-umber">{jsonList(home.whole_home_constraints)}</p>
            </div>
          </div>
        </section>

        <PreferencesManager homeId={home.id} initialPreferences={preferences} />

        <section className="grid gap-10">
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-6">
            <div>
              <p className="atelier-eyebrow">Rooms</p>
              <h2 className="mt-3 font-serif text-4xl text-atelier-ink">
                Room by <em className="italic">room</em>
              </h2>
            </div>
            <Link href={`/homes/${home.id}/rooms/new`} data-testid="room-new-link" className="atelier-btn">
              Add a room
            </Link>
          </div>

          {rooms.length === 0 ? (
            <div className="atelier-empty">The first room begins the home.</div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  data-testid={`room-card-${room.id}`}
                  className="atelier-card grid gap-5 p-8 transition-colors duration-300 hover:border-atelier-brass/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="atelier-label">{room.room_type || "Room"}</p>
                      <h3 className="mt-2 font-serif text-2xl text-atelier-ink">{room.name}</h3>
                    </div>
                    <span aria-hidden="true" className="font-serif text-xl text-atelier-taupe">
                      →
                    </span>
                  </div>
                  <p className="text-sm font-light leading-7 text-atelier-umber">
                    {room.purpose || "Add a purpose and design brief."}
                  </p>
                  <span className={`atelier-status w-fit ${room.job_status ? "border-atelier-brass/50 text-atelier-brass" : ""}`}>
                    {room.job_status ? jobLabel(room.job_status, room.job_type) : statusLabel(room.current_stage || room.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function jsonList(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Not defined yet.";
}

function statusLabel(status: string) {
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status;
}

function jobLabel(status: string, type: string | null | undefined) {
  const noun = type === "batch_render" ? "Perspectives" : type === "chat_action" ? "Requested change" : type === "diagnosis" ? "Room reading" : type === "render" ? "Visualization" : "Design step";
  return status === "retryable_failed" || status === "terminal_failed" ? `${noun} needs attention` : `${noun} in progress`;
}
