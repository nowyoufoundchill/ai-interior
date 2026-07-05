import { AppShell } from "@/components/layout/app-shell";
import { HomeForm } from "@/components/forms/home-form";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/env";

export default function NewHomePage() {
  return (
    <AppShell>
      {isSupabaseConfigured() ? <HomeForm /> : <SetupNotice />}
    </AppShell>
  );
}
