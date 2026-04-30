"use client";

import React, { FormEvent, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Globe, Calendar, Activity } from "@/components/Icons";

export default function Navbar({ status }: { status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = inputRef.current?.value.trim() || "";
    if (!value) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-card-border/80 bg-[rgba(3,10,16,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-glow/25 bg-cyan-glow/8 shadow-[0_0_25px_rgba(92,225,255,0.14)]">
            <Activity className="h-5 w-5 text-cyan-glow" />
          </div>
          <div className="min-w-0">
            <div className="tactical-label">Geo Social Command</div>
            <h1 className="truncate text-lg font-semibold uppercase tracking-[0.28em] text-foreground sm:text-xl">
              Social Radar
            </h1>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center xl:flex">
          <form
            onSubmit={onSubmit}
            className="glass-panel flex w-full max-w-xl items-center gap-3 rounded-full px-4 py-2"
          >
            <Search className="h-4 w-4 text-cyan-glow" />
            <input
              key={`search-input-${pathname}`}
              ref={inputRef}
              type="text"
              placeholder="Search trends, actors, regions, entities"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="rounded-full border border-cyan-glow/30 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-glow hover:bg-cyan-glow/10"
            >
              Search
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="glass-panel hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-muted md:flex">
            <Globe className="h-4 w-4 text-cyan-glow" />
            <span>Global Theater</span>
          </div>

          <div className="glass-panel hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-muted lg:flex">
            <Calendar className="h-4 w-4 text-cyan-glow" />
            <span>Rolling 24 Hours</span>
          </div>

          <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                status === "running" ? "bg-green-glow animate-pulse" : "bg-danger"
              }`}
            />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-200 sm:text-sm">
              {status === "running" ? "Live Sync" : "Reconnecting"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
