export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoomForm } from "@/components/forms/room-form";
import { getHome } from "@/lib/data/queries";

export default async function NewRoomPage({ params }: { params: Promise<{ homeId: string }> }) {
  const { homeId } = await params;
  const home = await getHome(homeId).catch(() => null);

  if (!home) notFound();

  return (
    <AppShell>
      <div className="atelier-rise mx-auto grid max-w-4xl gap-10">
        <div className="border-b border-hairline pb-8">
          <p className="atelier-eyebrow">{home.name}</p>
          <h1 className="mt-3 font-serif text-5xl text-atelier-ink">
            A new <em className="italic">room</em>
          </h1>
        </div>
        <RoomForm homeId={homeId} />
      </div>
    </AppShell>
  );
}
