"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Map, Clock, Cpu, Settings } from "@/components/Icons";

export default function Sidebar() {
  const pathname = usePathname();
  const links = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Trends", href: "/trends", icon: TrendingUp },
    { name: "Map", href: "/map", icon: Map },
    { name: "Regions", href: "/regions", icon: Map },
    { name: "Historical", href: "/historical", icon: Clock },
    { name: "AI Analyst", href: "/ai-analyst", icon: Cpu },
  ];

  return (
    <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-72 shrink-0 px-4 py-5 xl:block">
      <div className="glass-panel flex h-full flex-col justify-between rounded-[28px] p-4">
        <div>
          <div className="mb-5 px-3">
            <div className="tactical-label">Operations Menu</div>
            <div className="mt-2 text-sm text-muted">
              Global monitoring surfaces and analytical workspaces.
            </div>
          </div>
          <nav className="space-y-2">
            {links.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  prefetch={true}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border border-cyan-glow/20 bg-cyan-glow/10 text-cyan-glow shadow-[0_0_22px_rgba(92,225,255,0.08)]"
                      : "text-muted hover:bg-white/4 hover:text-foreground"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-card-border/90 bg-black/20 p-4">
            <div className="tactical-label">Coverage</div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                  <span>X / Reddit / YouTube</span>
                  <span>84%</span>
                </div>
                <div className="data-bar h-2"><span style={{ width: "84%" }} /></div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                  <span>Regional Signal Mesh</span>
                  <span>61%</span>
                </div>
                <div className="data-bar h-2"><span style={{ width: "61%" }} /></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-card-border/80 px-4 py-3 text-sm font-medium text-muted">
            <Settings className="h-4 w-4" />
            Settings (coming soon)
          </div>
        </div>
      </div>
    </aside>
  );
}
