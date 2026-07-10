import Link from "next/link";

// Top-level nav stays at the studio/home level. Pipeline stages (concepts,
// renders, products, chat) live inside a room, not in the global nav, so the
// app doesn't read as a stack of tool tabs.
const navItems = [
  { href: "/dashboard", label: "Studio", testId: "nav-link-dashboard" },
  { href: "/dashboard", label: "Homes", testId: "nav-link-homes" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-atelier-paper">
      <header className="border-b border-hairline bg-atelier-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
          <Link href="/dashboard" data-testid="nav-logo-link" className="flex flex-col gap-1">
            <span className="font-serif text-2xl leading-none text-atelier-ink">
              AI Interior <em className="italic">Designer</em>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wm text-atelier-brass">
              Intelligent Spaces, Composed
            </span>
          </Link>
          <nav className="hidden items-center gap-10 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                data-testid={item.testId}
                className="atelier-btn-line text-atelier-umber hover:text-atelier-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14 md:px-10">{children}</main>
      <footer className="mt-16 bg-atelier-charcoal">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-14 md:px-10">
          <span className="font-serif text-xl text-atelier-ivory">
            AI Interior <em className="italic">Designer</em>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide2 text-atelier-ivory/40">
            A private studio — one household
          </span>
        </div>
      </footer>
    </div>
  );
}
