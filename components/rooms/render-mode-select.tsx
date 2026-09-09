import type { RenderMode } from "@/lib/ai/render-contract";

export function RenderModeSelect({ value, onChange, disabled }: {
  value: RenderMode;
  onChange: (value: RenderMode) => void;
  disabled?: boolean;
}) {
  return (
    <details className="text-sm text-atelier-umber">
      <summary className="cursor-pointer">Render options · {value === "designer" ? "Designer Render" : "Concept"}</summary>
      <label className="mt-3 grid gap-2">
        <span>Render mode</span>
        <select className="atelier-field" value={value} onChange={(event) => onChange(event.target.value as RenderMode)} disabled={disabled}>
          <option value="designer">Designer Render — precise, photorealistic</option>
          <option value="concept">Concept — faster exploration</option>
        </select>
      </label>
      <p className="mt-2">Each request creates one version. Revisit the direction with another edit whenever you like.</p>
    </details>
  );
}
