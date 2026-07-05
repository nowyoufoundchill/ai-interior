export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoomWorkspace } from "@/components/rooms/room-workspace";
import { getRoomWorkspace } from "@/lib/data/queries";

export default async function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const workspace = await getRoomWorkspace(roomId).catch(() => null);

  if (!workspace || !workspace.home) notFound();

  return (
    <AppShell>
      <RoomWorkspace {...workspace} home={workspace.home} />
    </AppShell>
  );
}

