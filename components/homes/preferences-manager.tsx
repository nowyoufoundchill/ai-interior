"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignPreference } from "@/lib/data/queries";

const PREFERENCE_TYPES = [
  { value: "style", label: "Style" },
  { value: "color", label: "Color" },
  { value: "material", label: "Material" },
  { value: "avoid", label: "Avoid" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "General" }
] as const;

// Cautionary types carry the clay tone; everything else stays hairline-quiet.
const TYPE_TONE: Record<string, string> = {
  avoid: "border-atelier-clay/50 text-atelier-clay",
  constraint: "border-atelier-brass/50 text-atelier-brass"
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
    <section className="grid gap-8">
      <div className="border-b border-hairline pb-6">
        <p className="atelier-eyebrow">Whole-home memory</p>
        <h2 className="mt-3 font-serif text-4xl text-atelier-ink">
          Your confirmed <em className="italic">taste</em>
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-light leading-7 text-atelier-umber">
          Save the decisions that should connect every room. A room&apos;s own needs and constraints
          stay with that room and take priority when they differ.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[0.4fr_1fr_auto] md:items-end">
        <label className="grid gap-2">
          <span className="atelier-label">Type</span>
          <select data-testid="preferences-type-select" className="atelier-field" value={type} onChange={(event) => setType(event.target.value)}>
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
            data-testid="preferences-label-input"
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
          data-testid="preferences-add-button"
          onClick={add}
          disabled={busy || !label.trim()}
          className="atelier-btn"
        >
          Add
        </button>
      </div>

      {preferences.length === 0 ? (
        <div className="atelier-empty">The shared decisions that should connect every room.</div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {preferences.map((preference) => (
            <span
              key={preference.id}
              data-testid={`preference-card-${preference.id}`}
              className={`flex min-h-11 items-center gap-3 border bg-atelier-paper px-4 py-2 text-sm ${
                TYPE_TONE[preference.preference_type] ?? "border-hairline text-atelier-umber"
              }`}
            >
              <span className="text-[9px] font-medium uppercase tracking-label opacity-70">{preference.preference_type}</span>
              <span className="font-light text-atelier-ink">{preference.label}</span>
              <button
                type="button"
                data-testid={`preference-remove-button-${preference.id}`}
                onClick={() => remove(preference.id)}
                disabled={busy}
                aria-label="Remove preference"
                className="text-xs text-atelier-brass opacity-70 transition-opacity duration-300 hover:opacity-100 disabled:opacity-30"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
