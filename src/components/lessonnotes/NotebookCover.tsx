import { themeForIndex } from "@/lib/lessonnotes/themes";

export interface NotebookCoverData {
  title: string | null;
  teacher: string;
  class_name: string;
  session: string;
  subject: string;
  color_index: number;
}

interface Props {
  notebook: NotebookCoverData;
  onClick?: () => void;
}

/**
 * Realistic-ish notebook front cover. Uses a colored gradient + spiral binding
 * on the left edge + an embossed title plate. Clean and academic — easy to
 * upgrade later (option A in the plan) without changing the API.
 */
export const NotebookCover = ({ notebook, onClick }: Props) => {
  const t = themeForIndex(notebook.color_index ?? 0);
  const isLight = (notebook.color_index ?? 0) === 9; // cream

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[3/4] w-full rounded-r-md rounded-l-sm overflow-hidden text-left shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6),0_4px_8px_-4px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 hover:shadow-[0_18px_35px_-12px_rgba(0,0,0,0.7)] focus:outline-none focus:ring-2 focus:ring-primary"
      style={{ background: t.gradient, color: t.ink, border: `1px solid ${t.edge}` }}
      aria-label={`Open notebook ${notebook.title ?? notebook.subject}`}
    >
      {/* Spiral binding */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 flex flex-col items-center justify-around py-2"
        style={{ background: `linear-gradient(90deg, ${t.edge}, transparent)` }}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: isLight ? "#3a2f1c" : "rgba(255,255,255,0.55)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)" }}
          />
        ))}
      </div>

      {/* Subtle paper grain */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.4) 1px, transparent 1px)",
          backgroundSize: "6px 6px, 9px 9px",
          backgroundPosition: "0 0, 3px 3px",
        }}
      />

      {/* Corner accent badge */}
      <div
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] tracking-widest uppercase font-semibold"
        style={{ background: t.accent, color: isLight ? "#3a2f1c" : "#0a0a0a" }}
      >
        Teacher
      </div>

      {/* Content */}
      <div className="absolute inset-0 pl-5 pr-3 pt-7 pb-4 flex flex-col">
        <div className="text-center">
          <div className="text-[9px] tracking-[0.3em] opacity-70 uppercase">Math</div>
          <div className="text-base font-black tracking-wider" style={{ color: t.accent }}>
            GPL
          </div>
          <div className="text-[9px] tracking-[0.4em] opacity-80 uppercase mt-0.5">Notebook</div>
          <div
            className="mx-auto mt-2 h-0.5 w-10 rounded-full"
            style={{ background: t.accent, opacity: 0.8 }}
          />
        </div>

        <div className="mt-auto space-y-1 text-[10px] leading-snug">
          <Row label="Teacher" value={notebook.teacher} />
          <Row label="Class" value={notebook.class_name} />
          <Row label="Session" value={notebook.session} />
          <Row label="Subject" value={notebook.subject} />
        </div>
      </div>
    </button>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-1.5">
    <span className="opacity-60 w-12 flex-none">{label}:</span>
    <span className="font-medium truncate">{value || "—"}</span>
  </div>
);

export default NotebookCover;
