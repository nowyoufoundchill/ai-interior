import Link from "next/link";
import { Home, LayoutDashboard, MessageSquare, Package, Sparkles } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-link-dashboard" },
  { href: "/dashboard", label: "Homes", icon: Home, testId: "nav-link-homes" },
  { href: "/dashboard", label: "Mood Boards", icon: Sparkles, testId: "nav-link-mood-boards" },
  { href: "/dashboard", label: "Products", icon: Package, testId: "nav-link-products" },
  { href: "/dashboard", label: "Design Chat", icon: MessageSquare, testId: "nav-link-design-chat" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-atelier-taupe/20 bg-atelier-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" data-testid="nav-logo-link" className="flex flex-col">
            <span className="font-serif text-2xl text-atelier-ink">AI Interior Atelier</span>
            <span className="text-xs uppercase tracking-[0.22em] text-atelier-taupe">Private studio</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  data-testid={item.testId}
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-atelier-charcoal transition hover:bg-atelier-linen"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
