export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PreferencesManager } from "@/components/homes/preferences-manager";
import { RoomList } from "@/components/homes/room-list";
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
              <p className="mt-3 max-w-xl text-sm font-light leading-6 text-atelier-umber">
                Each room keeps its latest photograph or design, where it stands, and the one next step.
              </p>
            </div>
            <Link href={`/homes/${home.id}/rooms/new`} data-testid="room-new-link" className="atelier-btn">
              Add a room
            </Link>
          </div>

          <RoomList initialRooms={rooms} />
        </section>
      </div>
    </AppShell>
  );
}

function jsonList(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Not defined yet.";
}
