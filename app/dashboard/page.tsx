export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, Home, Plus, Sparkles } from "lucide-react";
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
      <div className="grid gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="atelier-label">Private design studio</p>
            <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-tight text-atelier-ink">
              A calm workspace for designing the whole home, room by room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-atelier-charcoal">
              Add a room, choose a concept direction, and see it rendered on your real room photos.
              Refine in chat, then source the products to make it real.
            </p>
          </div>
          <div className="atelier-card flex flex-col justify-between gap-6 p-6">
            <Sparkles className="h-8 w-8 text-atelier-brass" aria-hidden="true" />
            <div>
              <p className="atelier-label">Next step</p>
              <p className="mt-2 text-sm leading-6 text-atelier-charcoal">
                Start with a home profile so each room can inherit palette, architecture, budget, and
                whole-home consistency notes.
              </p>
            </div>
            <Link
              href="/homes/new"
              data-testid="home-new-link"
              className="flex w-fit items-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal"
            >
              <Plus className="h-4 w-4" />
              New home
            </Link>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="atelier-label">Homes</p>
              <h2 className="mt-2 font-serif text-3xl">Project library</h2>
            </div>
            <Link
              href="/homes/new"
              data-testid="home-new-link-secondary"
              className="hidden rounded-md border border-atelier-taupe/30 px-4 py-2 text-sm font-semibold md:block"
            >
              Add home
            </Link>
          </div>

          {homes.length === 0 ? (
            <div className="rounded-md border border-dashed border-atelier-taupe/40 bg-white/50 p-8 text-center text-sm text-atelier-charcoal">
              Create your first home project to begin.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {homes.map((home) => {
                const rooms = Array.isArray(home.rooms) ? home.rooms : [];
                return (
                  <Link
                    key={home.id}
                    href={`/homes/${home.id}`}
                    data-testid={`home-card-${home.id}`}
                    className="atelier-card grid gap-5 p-6 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="atelier-label">{home.region || "Home project"}</p>
                        <h3 className="mt-2 font-serif text-3xl">{home.name}</h3>
                      </div>
                      <ArrowRight className="h-5 w-5 text-atelier-taupe" />
                    </div>
                    <p className="text-sm leading-6 text-atelier-charcoal">
                      {home.style_notes || "Add style notes to guide room-level concepts."}
                    </p>
                    <div className="grid gap-2">
                      {rooms.length === 0 ? (
                        <p className="text-sm text-atelier-taupe">No rooms yet.</p>
                      ) : (
                        rooms.slice(0, 4).map((room) => (
                          <div key={room.id} className="flex items-center justify-between rounded-md bg-atelier-linen px-3 py-2 text-sm">
                            <span className="flex items-center gap-2">
                              <Home className="h-4 w-4" />
                              {room.name}
                            </span>
                            <span className="text-xs text-atelier-taupe">{statusLabel(room.current_stage || room.status)}</span>
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

