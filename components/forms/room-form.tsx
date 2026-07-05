import { createRoomAction } from "@/lib/data/actions";

export function RoomForm({ homeId }: { homeId: string }) {
  const action = createRoomAction.bind(null, homeId);

  return (
    <form action={action} className="atelier-card grid gap-6 p-6">
      <div>
        <p className="atelier-label">Room brief</p>
        <h1 className="mt-2 font-serif text-3xl">Add a room</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="atelier-label">Room name</span>
          <input name="name" required className="atelier-field" placeholder="Office" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Room type</span>
          <input name="room_type" className="atelier-field" placeholder="Home office, living room, bedroom" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Primary purpose</span>
          <input name="purpose" className="atelier-field" placeholder="Focused work, reading, client video calls" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Budget range</span>
          <input name="budget_range" className="atelier-field" placeholder="$5k-$12k" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Width</span>
          <input name="width" className="atelier-field" placeholder="12 ft" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Length</span>
          <input name="length" className="atelier-field" placeholder="14 ft" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Ceiling height</span>
          <input name="ceiling_height" type="number" step="0.1" className="atelier-field" placeholder="9" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Dimension notes</span>
          <input name="dimension_notes" className="atelier-field" placeholder="Awkward nook, closet wall, long narrow room" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="atelier-label">Style preferences</span>
          <textarea name="style_preferences" rows={3} className="atelier-field" placeholder="moody coastal, masculine executive, organic modern" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Color preferences</span>
          <textarea name="color_preferences" rows={3} className="atelier-field" placeholder="dark olive, warm white, oak, brass" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Constraints</span>
          <textarea name="constraints" rows={3} className="atelier-field" placeholder="keep leather chair, hide printer, protect natural light" />
        </label>
        <label className="grid gap-2">
          <span className="atelier-label">Existing items</span>
          <textarea name="existing_items" rows={3} className="atelier-field" placeholder="brown leather chair, black bookcase, framed map" />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="atelier-label">Design brief</span>
        <textarea
          name="design_brief"
          rows={6}
          className="atelier-field"
          placeholder="Describe what you want the room to feel like, what needs to work better, and what you already know you dislike."
        />
      </label>

      <button className="w-fit rounded-md bg-atelier-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal">
        Create room
      </button>
    </form>
  );
}
