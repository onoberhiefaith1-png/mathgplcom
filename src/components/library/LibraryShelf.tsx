// Calm classroom shelf. Games and flows share it: card spines on a wood rail.
import type { ReactNode } from "react";

export type ShelfItem = {
  id: string;
  title: string;
  detail?: string;
};

const SPINES = ["#3f5c4d", "#6e4c3a", "#3d4f66", "#8c4a3a", "#5c5346", "#3e5a55", "#6b3d4a", "#4a5560"];

const spineColor = (id: string) => {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * (i + 1)) % SPINES.length;
  return SPINES[n] ?? SPINES[0];
};

export function LibraryShelf({
  eyebrow,
  title,
  description,
  items,
  empty,
  selectedId,
  onSelect,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: ShelfItem[];
  empty: string;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? null;
  return (
    <section className="rounded-xl border border-[#e4d8c4] bg-[#f7f1e6] p-4 text-[#2c241c] shadow-sm sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d6a43]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-[#5c5346]">{description}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#5c5346]">{empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto pb-1">
          <div
            className="flex min-h-[210px] items-end gap-1.5 rounded-t-md px-3 pt-3"
            style={{
              background: "linear-gradient(180deg, rgba(255,252,245,0.35), rgba(196,165,116,0.18))",
              boxShadow: "inset 0 -12px 0 #c4a574, 0 10px 0 #8d6a43",
            }}
          >
            {items.map((item) => {
              const on = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-pressed={on}
                  title={item.title}
                  className="relative h-44 w-11 shrink-0 rounded-t-sm px-1 shadow-md transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d6a43]"
                  style={{
                    background: spineColor(item.id),
                    color: "#f6f1e7",
                    boxShadow: on ? "inset 0 4px 0 #f5b93a, 0 8px 16px rgba(44,36,28,0.25)" : undefined,
                  }}
                >
                  <span className="absolute inset-x-1 top-3 bottom-3 overflow-hidden text-[11px] font-medium leading-tight [writing-mode:vertical-rl]">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.title}</p>
            {selected.detail ? <p className="truncate text-xs text-[#5c5346]">{selected.detail}</p> : null}
          </div>
          {footer}
        </div>
      ) : items.length > 0 ? (
        <p className="mt-3 text-xs text-[#5c5346]">Choose a spine to use it.</p>
      ) : null}
    </section>
  );
}

export default LibraryShelf;
