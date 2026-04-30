import { CATEGORY_OPTIONS, type TrendCategory } from "@/lib/trends";

export default function CategoryFilter({
  selected,
  onSelect,
}: {
  selected: TrendCategory | "All";
  onSelect: (value: TrendCategory | "All") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("All")}
        className={`rounded-full border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-all ${
          selected === "All"
            ? "border-green-glow/35 bg-green-glow/10 text-green-glow"
            : "border-card-border/80 bg-black/20 text-muted hover:text-foreground"
        }`}
      >
        All
      </button>
      {CATEGORY_OPTIONS.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`rounded-full border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-all ${
            selected === category
              ? "border-green-glow/35 bg-green-glow/10 text-green-glow"
              : "border-card-border/80 bg-black/20 text-muted hover:text-foreground"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
