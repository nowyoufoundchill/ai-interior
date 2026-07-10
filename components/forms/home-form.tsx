import { createHomeAction } from "@/lib/data/actions";

export function HomeForm() {
  return (
    <form action={createHomeAction} className="atelier-rise mx-auto grid max-w-4xl gap-10">
      <div className="border-b border-hairline pb-8">
        <p className="atelier-eyebrow">Home profile</p>
        <h1 className="mt-3 font-serif text-5xl text-atelier-ink">
          Begin a <em className="italic">home</em>
        </h1>
        <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-atelier-umber">
          Every room will inherit from what you set here — palette, architecture, budget, one
          continuous taste.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
        <label className="grid gap-2">
          <span className="atelier-label">Property value band</span>
          <select data-testid="home-value-band-input" name="value_band" className="atelier-field" defaultValue="">
            <option value="">Prefer not to say</option>
            <option value="$1m-$3m">$1m – $3m — edited luxury</option>
            <option value="$3m-$6m">$3m – $6m — authored, full-service</option>
            <option value="$6m-$10m">$6m – $10m — fully authored, whole-system</option>
          </select>
          <span className="text-xs font-light text-atelier-fawn">Sets the level of authorship concepts target. Optional.</span>
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

      <button data-testid="home-create-submit" className="atelier-btn w-fit">
        Create the home
      </button>
    </form>
  );
}
