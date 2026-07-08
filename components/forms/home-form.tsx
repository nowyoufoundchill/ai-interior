import { createHomeAction } from "@/lib/data/actions";

export function HomeForm() {
  return (
    <form action={createHomeAction} className="atelier-card grid gap-6 p-6">
      <div>
        <p className="atelier-label">Home profile</p>
        <h1 className="mt-2 font-serif text-3xl">Create a home project</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="atelier-label">Home name</span>
          <input data-testid="home-name-input" name="name" required className="atelier-field" placeholder="Charleston house" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Region</span>
          <input data-testid="home-region-input" name="region" className="atelier-field" placeholder="Charleston, coastal South, mountain town" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Home type</span>
          <input data-testid="home-type-input" name="home_type" className="atelier-field" placeholder="New build, historic cottage, townhouse" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Whole-home palette</span>
          <input data-testid="home-palette-input" name="whole_home_palette" className="atelier-field" placeholder="warm white, oak, moss, brass" />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="atelier-label">Style notes</span>
        <textarea
          data-testid="home-style-notes-input"
          name="style_notes"
          rows={5}
          className="atelier-field"
          placeholder="Coastal but not beachy, warm woods, natural texture, elevated but comfortable."
        />
      </label>

      <label className="grid gap-2">
        <span className="atelier-label">Whole-home constraints</span>
        <textarea
          data-testid="home-constraints-input"
          name="whole_home_constraints"
          rows={3}
          className="atelier-field"
          placeholder="Kid friendly, keep existing art, avoid cold gray, repeat black accents."
        />
      </label>

      <button data-testid="home-create-submit" className="w-fit rounded-md bg-atelier-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal">
        Create home
      </button>
    </form>
  );
}
