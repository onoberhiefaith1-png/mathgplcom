import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLanguages } from "@/lib/editor/languages";

interface Props {
  value: string;
  onChange: (language: string) => void;
  label?: string;
}

/** Searchable list of every speech language the engine supports, plus free text. */
export function LanguagePicker({ value, onChange, label = "Spoken language" }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchLanguages(query), [query]);

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1 text-xs text-muted-foreground">
          {label}
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search a language, or type your own below"
              className="h-9 pl-7"
            />
          </div>
        </label>
        <label className="min-w-[180px] text-xs text-muted-foreground">
          Selected
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 h-9 text-foreground"
          />
        </label>
      </div>

      <ul className="mt-2 grid max-h-[150px] gap-1 overflow-y-auto pr-1 sm:grid-cols-3">
        {results.map((language) => (
          <li key={language}>
            <button
              type="button"
              onClick={() => onChange(language)}
              className={`w-full rounded px-2 py-1 text-left text-xs ${
                language === value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {language}
            </button>
          </li>
        ))}
        {results.length === 0 ? (
          <li className="text-xs text-muted-foreground">
            No match — type the language in the Selected field.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
