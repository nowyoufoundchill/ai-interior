export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { getHomes } from "@/lib/data/queries";
import { ROOM_STATUSES } from "@/lib/constants";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell>
        <SetupNotice />
      </AppShell>
    );
  }

  const homes = await getHomes();

  return (
    <AppShell>
      <div className="atelier-rise grid gap-20">
        {/* The dusk room: a charcoal statement field carrying the display line.
            One statement moment per page, brass as the only voice of emphasis. */}
        <section className="grid overflow-hidden border border-hairline bg-atelier-charcoal lg:grid-cols-[1.35fr_0.65fr]">
          <div className="flex flex-col justify-between gap-16 p-10 md:p-14">
            <p className="atelier-eyebrow">Private studio</p>
            <div>
              <h1 className="max-w-3xl font-serif text-5xl leading-[1.06] text-atelier-ivory md:text-6xl">
                Rooms that <em className="italic text-[#E8D9BE]">listen.</em>
              </h1>
              <p className="mt-7 max-w-xl text-sm font-light leading-7 text-atelier-ivory/60">
                Begin with one photograph. Approve a direction. See it composed in your own room,
                then talk it through and source the pieces that make it real.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-10 border-t border-hairline-light p-10 lg:border-l lg:border-t-0 md:p-12">
            <div>
              <p className="atelier-eyebrow">Begin</p>
              <p className="mt-4 text-sm font-light leading-7 text-atelier-ivory/60">
                Every room inherits from the home — palette, architecture, budget, one continuous
                taste.
              </p>
            </div>
            <Link href="/homes/new" data-testid="home-new-link" className="atelier-btn-dark w-fit">
              Begin a home
            </Link>
          </div>
        </section>

        <section className="grid gap-10">
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-6">
            <div>
              <p className="atelier-eyebrow">The collection</p>
              <h2 className="mt-3 font-serif text-4xl text-atelier-ink">
                Homes in the <em className="italic">studio</em>
              </h2>
            </div>
            <Link href="/homes/new" data-testid="home-new-link-secondary" className="atelier-btn-line hidden md:inline-flex">
              Add a home
            </Link>
          </div>

          {homes.length === 0 ? (
            <div className="atelier-empty">Begin with a single home.</div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {homes.map((home) => {
                const rooms = Array.isArray(home.rooms) ? home.rooms : [];
                return (
                  <Link
                    key={home.id}
                    href={`/homes/${home.id}`}
                    data-testid={`home-card-${home.id}`}
                    className="atelier-card grid gap-6 p-8 transition-colors duration-300 hover:border-atelier-brass/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="atelier-label">{home.region || "Home"}</p>
                        <h3 className="mt-2 font-serif text-3xl text-atelier-ink">{home.name}</h3>
                      </div>
                      <span aria-hidden="true" className="font-serif text-xl text-atelier-taupe">
                        →
                      </span>
                    </div>
                    <p className="text-sm font-light leading-7 text-atelier-umber">
                      {home.style_notes || "Add style notes to guide room-level concepts."}
                    </p>
                    <div className="grid">
                      {rooms.length === 0 ? (
                        <p className="text-sm font-light italic text-atelier-fawn">No rooms yet.</p>
                      ) : (
                        rooms.slice(0, 4).map((room) => (
                          <div
                            key={room.id}
                            className="flex items-baseline justify-between border-t border-hairline py-3 text-sm"
                          >
                            <span className="font-light text-atelier-ink">{room.name}</span>
                            <span className="atelier-label">{statusLabel(room.current_stage || room.status)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function statusLabel(status: string) {
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status;
}
