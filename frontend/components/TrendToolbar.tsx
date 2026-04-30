import { SORT_OPTIONS, type SortValue } from "@/lib/trends";

export default function TrendToolbar({
  sortBy,
  hashtag,
  keyword,
  onSortChange,
  onHashtagChange,
  onKeywordChange,
}: {
  sortBy: SortValue;
  hashtag: string;
  keyword: string;
  onSortChange: (value: SortValue) => void;
  onHashtagChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_0.8fr_1fr]">
      <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
        <span className="tactical-label">Sort By</span>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value as SortValue)}
          className="mt-2 w-full bg-transparent text-sm text-foreground outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-[#0a1620] text-foreground"
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
        <span className="tactical-label">Hashtag Filter</span>
        <input
          value={hashtag}
          onChange={(event) => onHashtagChange(event.target.value)}
          placeholder="#iran"
          className="mt-2 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>

      <label className="rounded-2xl border border-card-border/80 bg-black/20 px-4 py-3">
        <span className="tactical-label">Search Keyword</span>
        <input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Search titles or keywords"
          className="mt-2 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>
    </div>
  );
}
