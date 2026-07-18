export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AutopilotRoomWorkspace } from "@/components/rooms/autopilot-room-workspace";
import { getRoomWorkspace } from "@/lib/data/queries";

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const workspace = await getRoomWorkspace(roomId).catch(() => null);

  if (!workspace || !workspace.home) notFound();

  return (
    <AppShell>
      <AutopilotRoomWorkspace room={workspace.room} photos={workspace.photos} renders={workspace.renders} generationJobs={workspace.generationJobs} />
    </AppShell>
  );
}

