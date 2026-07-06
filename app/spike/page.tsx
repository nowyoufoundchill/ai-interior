import { AppShell } from "@/components/layout/app-shell";
import { SpikeWorkbench } from "@/components/spike/spike-workbench";

export const dynamic = "force-dynamic";

export default function SpikePage() {
  return (
    <AppShell>
      <SpikeWorkbench />
    </AppShell>
  );
}
