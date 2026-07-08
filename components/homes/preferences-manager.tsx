"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { DesignPreference } from "@/lib/data/queries";

const PREFERENCE_TYPES = [
  { value: "style", label: "Style" },
  { value: "color", label: "Color" },
  { value: "material", label: "Material" },
  { value: "avoid", label: "Avoid" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "General" }
] as const;

const TYPE_TONE: Record<string, string> = {
  avoid: "bg-rose-100 text-rose-700",
  constraint: "bg-amber-100 text-amber-800"
};

export function PreferencesManager(props: { homeId: string; initialPreferences: DesignPreference[] }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(props.initialPreferences);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<string>("style");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/homes/${props.homeId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), preference_type: type })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload.error ?? "Could not save the preference.");
        return;
      }
      setPreferences((current) => [payload.preference as DesignPreference, ...current]);
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/homes/${props.homeId}/preferences/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error ?? "Could not remove the preference.");
        return;
      }
      setPreferences((current) => current.filter((preference) => preference.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div>
        <p className="atelier-label">Design preferences</p>
        <h2 className="mt-2 font-serif text-3xl">Your confirmed taste</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-atelier-charcoal">
          These home-level preferences are the source of truth for the studio&apos;s taste graph and outrank a first brief. Design chat can suggest new ones, but nothing is saved here until you add it.
        </p>
      </div>

      <div className="atelier-card grid gap-3 p-5 md:grid-cols-[0.4fr_1fr_auto] md:items-end">
        <label className="grid gap-2">
          <span className="atelier-label">Type</span>
          <select className="atelier-field" value={type} onChange={(event) => setType(event.target.value)}>
            {PREFERENCE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Preference</span>
          <input
            className="atelier-field"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
            placeholder="Warm woods over cool greys, no open shelving, keep the leather sofa..."
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !label.trim()}
          className="flex items-center justify-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {preferences.length === 0 ? (
        <div className="rounded-md border border-dashed border-atelier-taupe/40 bg-white/50 p-8 text-center text-sm text-atelier-charcoal">
          No confirmed preferences yet. Add the standing taste rules this home should always follow.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {preferences.map((preference) => (
            <span
              key={preference.id}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${TYPE_TONE[preference.preference_type] ?? "bg-atelier-linen text-atelier-charcoal"}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{preference.preference_type}</span>
              <span className="font-medium">{preference.label}</span>
              <button
                type="button"
                onClick={() => remove(preference.id)}
                disabled={busy}
                aria-label="Remove preference"
                className="text-current opacity-60 transition hover:opacity-100 disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
