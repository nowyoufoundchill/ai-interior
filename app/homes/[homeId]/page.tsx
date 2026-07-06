export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ROOM_STATUSES } from "@/lib/constants";
import { getHome } from "@/lib/data/queries";

export default async function HomeDetailPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const home = await getHome(homeId).catch(() => null);

  if (!home) notFound();

  const rooms = Array.isArray(home.rooms) ? home.rooms : [];

  return (
    <AppShell>
      <div className="grid gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="atelier-label">{home.region || home.home_type || "Home project"}</p>
            <h1 className="mt-2 font-serif text-5xl">{home.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-atelier-charcoal">
              {home.style_notes || "Add whole-home style notes to keep each room connected."}
            </p>
          </div>
          <div className="atelier-card grid gap-4 p-5">
            <div>
              <p className="atelier-label">Whole-home palette</p>
              <p className="mt-2 text-sm leading-6 text-atelier-charcoal">{jsonList(home.whole_home_palette)}</p>
            </div>
            <div>
              <p className="atelier-label">Constraints</p>
              <p className="mt-2 text-sm leading-6 text-atelier-charcoal">{jsonList(home.whole_home_constraints)}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="atelier-label">Rooms</p>
              <h2 className="mt-2 font-serif text-3xl">Design workspaces</h2>
            </div>
            <Link
              href={`/homes/${home.id}/rooms/new`}
              className="flex items-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal"
            >
              <Plus className="h-4 w-4" />
              Add room
            </Link>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-md border border-dashed border-atelier-taupe/40 bg-white/50 p-8 text-center text-sm text-atelier-charcoal">
              Add the first room for this home.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <Link key={room.id} href={`/rooms/${room.id}`} className="atelier-card grid gap-4 p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="atelier-label">{room.room_type || "Room"}</p>
                      <h3 className="mt-2 font-serif text-2xl">{room.name}</h3>
                    </div>
                    <ArrowRight className="h-5 w-5 text-atelier-taupe" />
                  </div>
                  <p className="text-sm leading-6 text-atelier-charcoal">{room.purpose || "Add a purpose and design brief."}</p>
                  <span className="w-fit rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
                    {statusLabel(room.current_stage || room.status)}
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

