import { PLATFORM_OPTIONS, type PlatformValue } from "@/lib/trends";

export default function PlatformTabs({
  selected,
  onSelect,
}: {
  selected: PlatformValue;
  onSelect: (value: PlatformValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORM_OPTIONS.map((tab) => {
        const active = tab.value === selected;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onSelect(tab.value)}
            className={`rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-all ${
              active
                ? "border-cyan-glow/40 bg-cyan-glow/12 text-cyan-glow shadow-[0_0_18px_rgba(92,225,255,0.12)]"
                : "border-card-border/80 bg-black/20 text-muted hover:border-cyan-glow/20 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
