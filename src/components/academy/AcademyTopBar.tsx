import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { Search } from "lucide-react";
import { searchCurriculum } from "@/data/curriculum";

const AcademyTopBar = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchCurriculum(query, 12), [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4 sm:gap-6 sm:p-6">
      <div
        ref={containerRef}
        className="pointer-events-auto relative w-full max-w-xs sm:max-w-sm"
      >
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur focus-within:border-primary">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search any maths topic…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden sm:text-base"
            aria-label="Search any maths topic"
          />
        </div>

        {open && query.trim() && (
          <ul
            role="listbox"
            className="absolute inset-x-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-1 shadow-[0_18px_60px_hsl(var(--background)/0.7)] backdrop-blur"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No matching topics yet.
              </li>
            ) : (
              results.map((result) => (
                <li key={`${result.kind}-${result.href}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      navigate(result.href);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-primary/15"
                  >
                    <span className="flex flex-col">
                      <span
                        className={
                          result.kind === "topic"
                            ? "uppercase tracking-[0.2em] text-foreground"
                            : "text-foreground"
                        }
                      >
                        {result.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {result.subjectName}
                        {result.kind === "subtopic" ? ` · ${result.topicName}` : ""}
                      </span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.25em] text-primary">
                      {result.kind}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <Link
        to="/auth"
        className="pointer-events-auto ml-auto inline-flex items-center rounded-full border border-primary/60 bg-background/55 px-4 py-2 text-sm font-medium text-primary shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-primary hover:bg-background/80 sm:px-5 sm:text-base"
      >
        Login / Sign Up
      </Link>
    </header>
  );
};

export default AcademyTopBar;
