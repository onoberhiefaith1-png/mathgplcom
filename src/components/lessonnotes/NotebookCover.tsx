import { useEffect, useState } from "react";
import { themeForIndex } from "@/lib/lessonnotes/themes";
import {
  NotebookCoverConfig,
  readCoverConfig,
  themeById,
  CoverPattern,
} from "@/lib/lessonnotes/coverThemes";
import { getCachedSignedUrl, getSignedUrl } from "@/lib/games/urls";

export interface NotebookCoverData {
  title: string | null;
  teacher: string;
  class_name: string;
  session: string;
  subject: string;
  color_index: number;
  subtopic?: string;
  /** Designed cover (theme + editable text + optional AI artwork). */
  cover_config?: unknown;
}

interface Props {
  notebook: NotebookCoverData;
  onClick?: () => void;
  /** Live preview override (used by the cover designer). */
  config?: NotebookCoverConfig;
}

const patternCss = (pattern: CoverPattern, accent: string): React.CSSProperties => {
  switch (pattern) {
    case "grid":
      return {
        backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
        backgroundSize: "18px 18px, 18px 18px",
        opacity: 0.16,
      };
    case "blueprint":
      return {
        backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px), linear-gradient(${accent} 1px, transparent 1px)`,
        backgroundSize: "9px 9px, 9px 9px, 45px 45px",
        opacity: 0.2,
      };
    case "geometry":
      return {
        backgroundImage: `linear-gradient(45deg, ${accent} 1px, transparent 1px), linear-gradient(-45deg, ${accent} 1px, transparent 1px)`,
        backgroundSize: "22px 22px, 22px 22px",
        opacity: 0.18,
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(${accent} 1.6px, transparent 1.6px)`,
        backgroundSize: "14px 14px",
        opacity: 0.35,
      };
    case "waves":
      return {
        backgroundImage: `repeating-radial-gradient(circle at 50% -20%, ${accent} 0 1px, transparent 1px 16px)`,
        opacity: 0.18,
      };
    case "circuit":
      return {
        backgroundImage: `linear-gradient(90deg, ${accent} 1px, transparent 1px), radial-gradient(${accent} 2px, transparent 2px)`,
        backgroundSize: "26px 26px, 26px 26px",
        opacity: 0.22,
      };
    default:
      return { opacity: 0 };
  }
};

/** Resolves a private storage path into a usable image URL. */
const useSignedArt = (path?: string | null) => {
  const [url, setUrl] = useState<string | null>(() => getCachedSignedUrl(path));
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    const cached = getCachedSignedUrl(path);
    if (cached) { setUrl(cached); return; }
    getSignedUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  return url;
};

/**
 * Notebook front cover. A notebook with a designed cover renders its theme,
 * editable text and optional AI artwork; anything else falls back to the
 * original MathGPL cover.
 */
export const NotebookCover = ({ notebook, onClick, config }: Props) => {
  const designed = config ?? (notebook.cover_config ? readCoverConfig(notebook.cover_config, notebook) : null);
  if (designed) return <DesignedCover notebook={notebook} cfg={designed} onClick={onClick} />;
  return <LegacyCover notebook={notebook} onClick={onClick} />;
};

const DesignedCover = ({
  notebook, cfg, onClick,
}: { notebook: NotebookCoverData; cfg: NotebookCoverConfig; onClick?: () => void }) => {
  const t = themeById(cfg.themeId);
  const art = useSignedArt(cfg.artPath);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[3/4] w-full overflow-hidden rounded-r-md rounded-l-sm text-left shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6),0_4px_8px_-4px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 focus:outline-hidden focus:ring-2 focus:ring-primary"
      style={{ background: t.gradient, color: t.ink, border: `1px solid ${t.edge}` }}
      aria-label={`Open notebook ${cfg.title || notebook.subject}`}
    >
      {art && (
        <img
          src={art}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: cfg.artOpacity ?? 0.55 }}
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={patternCss(t.pattern, t.accent)} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(180deg, transparent 35%, ${t.edge}80 100%)` }}
      />

      {/* Spiral binding */}
      <div
        className="absolute left-0 top-0 bottom-0 flex w-3 flex-col items-center justify-around py-2"
        style={{ background: `linear-gradient(90deg, ${t.edge}, transparent)` }}
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="block h-1.5 w-1.5 rounded-full" style={{ background: `${t.accent}aa` }} />
        ))}
      </div>

      {cfg.badge?.trim() && (
        <div
          className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest"
          style={{ background: t.accent, color: "#0d0d0d" }}
        >
          {cfg.badge}
        </div>
      )}

      <div className="absolute inset-0 flex flex-col pb-4 pl-5 pr-3 pt-7">
        <div className="text-center" style={{ fontFamily: t.font }}>
          {cfg.eyebrow?.trim() && (
            <div className="text-[9px] uppercase tracking-[0.35em] opacity-75">{cfg.eyebrow}</div>
          )}
          <div
            className={`mt-1 text-[15px] leading-tight font-black ${t.display ? "uppercase tracking-wider" : "tracking-tight"}`}
            style={{ color: t.accent }}
          >
            {cfg.title || "Untitled"}
          </div>
          {cfg.subtitle?.trim() && (
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.3em] opacity-80">{cfg.subtitle}</div>
          )}
          <div className="mx-auto mt-2 h-0.5 w-10 rounded-full" style={{ background: t.accent, opacity: 0.85 }} />
        </div>

        <div className="mt-auto space-y-1 text-[10px] leading-snug">
          {cfg.rows.filter((r) => r.label || r.value).map((r, i) => (
            <div key={i} className="flex gap-1.5">
              {r.label && <span className="w-14 flex-none opacity-60">{r.label}:</span>}
              <span className="truncate font-medium">{r.value || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
};

const LegacyCover = ({ notebook, onClick }: { notebook: NotebookCoverData; onClick?: () => void }) => {
  const t = themeForIndex(notebook.color_index ?? 0);
  const isLight = (notebook.color_index ?? 0) === 9; // cream

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[3/4] w-full rounded-r-md rounded-l-sm overflow-hidden text-left shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6),0_4px_8px_-4px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 hover:shadow-[0_18px_35px_-12px_rgba(0,0,0,0.7)] focus:outline-hidden focus:ring-2 focus:ring-primary"
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
          <Row label="Class" value={notebook.class_name} />
          <Row label="Session" value={notebook.session} />
          <Row label="Subject" value={notebook.subject} />
          <Row label="Topic" value={notebook.title ?? ""} />
          <Row label="Subtopic" value={notebook.subtopic ?? ""} />
        </div>

      </div>
    </button>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-1.5">
    <span className="opacity-60 w-14 flex-none">{label}:</span>
    <span className="font-medium truncate">{value || "—"}</span>
  </div>
);

export default NotebookCover;
