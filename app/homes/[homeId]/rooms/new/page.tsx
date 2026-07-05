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
      <div className="grid gap-5">
        <div>
          <p className="atelier-label">{home.name}</p>
          <h1 className="mt-2 font-serif text-4xl">New room workspace</h1>
        </div>
        <RoomForm homeId={homeId} />
      </div>
    </AppShell>
  );
}

