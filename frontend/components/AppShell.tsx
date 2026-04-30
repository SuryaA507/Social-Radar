"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import AlertTicker from "@/components/AlertTicker";
import { getApiBase } from "@/lib/api";
// import AlertsPanel from "@/components/AlertsPanel";

export default function AppShell({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState("connecting");
  const mountedRef = useRef(true);
  const pathname = usePathname();
  const mobileLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Trends", href: "/trends" },
    { name: "Map", href: "/map" },
    { name: "Regions", href: "/regions" },
    { name: "History", href: "/historical" },
    { name: "AI", href: "/ai-analyst" },
  ];

  // Debug logging
  useEffect(() => {
    console.log("AppShell mounted with pathname:", pathname);
  }, [pathname]);

  useEffect(() => {
    mountedRef.current = true;
    const apiBase = getApiBase();

    const fetchHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/api/health`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Health check failed with ${response.status}`);
        }
        const data: { ok?: boolean } = await response.json();
        if (mountedRef.current) {
          setStatus(data.ok ? "running" : "error");
        }
      } catch {
        if (mountedRef.current) {
          setStatus("error");
        }
      }
    };

    void fetchHealth();
    const intervalId = window.setInterval(() => {
      void fetchHealth();
    }, 30_000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Suspense
        fallback={
          <header className="sticky top-0 z-50 border-b border-card-border/80 bg-[rgba(3,10,16,0.72)] backdrop-blur-xl">
            <div className="mx-auto flex h-18 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="tactical-label">Loading navigation...</div>
            </div>
          </header>
        }
      >
        <Navbar status={status} />
      </Suspense>
      <AlertTicker />
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-3 sm:px-6 xl:hidden">
        <div className="glass-panel flex gap-2 overflow-x-auto rounded-full px-2 py-2">
          {mobileLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${
                  active
                    ? "border border-cyan-glow/30 bg-cyan-glow/12 text-cyan-glow"
                    : "border border-transparent text-muted"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <Sidebar />
        <main className="h-[calc(100vh-73px)] flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </main>
      </div>
      {/* <AlertsPanel /> */}
    </div>
  );
}
