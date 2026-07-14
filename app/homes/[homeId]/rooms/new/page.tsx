export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoomAutopilotIntake } from "@/components/forms/room-autopilot-intake";
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
          <h1 className="mt-3 font-serif text-5xl text-atelier-ink">Design this <em className="italic">room</em></h1>
          <p className="mt-4 max-w-2xl text-base font-light leading-7 text-atelier-umber">Start with one photo and the outcome you want. We will make one best-fit recommendation.</p>
        </div>
        <RoomAutopilotIntake homeId={homeId} />
      </div>
    </AppShell>
  );
}
