// PhaseStage — cinematic overlay for non-interactive lesson phases.
//
// Renders the calm, full-screen presentation for cover / topic / introduction /
// homework / summary. During interactive phases (explanation / example-step /
// guided / exercise) it stays transparent so the writing surface shows through.
//
// Nothing here generates math. It only presents whatever the notebook beat
// already carries.

import { useEffect, useState } from "react";
import type { Beat } from "@/lib/smartboard/presentation";
import type { LessonPhase } from "@/lib/smartboard/lessonPhase";
import { renderMathInline } from "@/lib/notebook/mathRender";

interface Props {
  phase: LessonPhase;
  beat: Beat | undefined;
  notebookTitle: string;
  topic: string;
  subtopic: string;
  dateLabel: string;
  ink: string;
  accent: string;
  /** Handwriting profile font stack (so intro/topic/summary look handwritten). */
  fontStack?: string;
  letterSpacing?: string;
}

const today = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const PhaseStage = ({
  phase, beat, notebookTitle, topic, subtopic, dateLabel, ink, accent,
  fontStack, letterSpacing,
}: Props) => {
  // Re-trigger entry animation when phase changes.
  const [enterKey, setEnterKey] = useState(0);
  useEffect(() => { setEnterKey((k) => k + 1); }, [phase, beat?.id]);

  const overlayPhases: LessonPhase[] = ["cover", "topic", "introduction", "homework", "summary"];
  const isOverlay = overlayPhases.includes(phase);
  if (!isOverlay) return null;

  const label = dateLabel || today();

  return (
    <div
      key={enterKey}
      className="absolute inset-0 z-15 grid place-items-center pointer-events-none sb-phase-fade"
      style={{
        color: ink,
        fontFamily: fontStack,
        letterSpacing,
      }}
    >
      <div className="text-center px-10 max-w-4xl">
        {phase === "cover" && (
          <>
            <div className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: accent }}>
              {label}
            </div>
            <h1 className="text-5xl md:text-6xl font-light leading-tight mb-6">
              {notebookTitle}
            </h1>
            {topic && (
              <div className="text-xl md:text-2xl opacity-80 mb-2">{topic}</div>
            )}
            {subtopic && (
              <div className="text-base md:text-lg opacity-50 sb-subtopic-out">{subtopic}</div>
            )}
          </>
        )}

        {phase === "topic" && (
          <>
            <div className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: accent }}>
              {label}
            </div>
            <h1 className="text-5xl md:text-6xl font-light leading-tight">
              {topic || notebookTitle}
            </h1>
          </>
        )}

        {phase === "introduction" && beat && (
          <div className="text-2xl md:text-3xl leading-relaxed font-light whitespace-pre-wrap">
            {beat.content}
          </div>
        )}

        {phase === "homework" && beat && (
          <div className="text-left w-full">
            <div className="text-xs uppercase tracking-[0.4em] mb-4" style={{ color: accent }}>
              {beat.caption ?? "Homework"}
            </div>
            <div className="text-2xl md:text-3xl">
              {renderMathInline(beat.content, beat.id)}
            </div>
          </div>
        )}

        {phase === "summary" && beat && (
          <div className="text-2xl md:text-3xl leading-relaxed font-light whitespace-pre-wrap">
            {beat.content}
          </div>
        )}
      </div>

      <style>{`
        .sb-phase-fade { animation: sbPhaseIn 600ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes sbPhaseIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sb-subtopic-out { animation: none; }
      `}</style>
    </div>
  );
};

export default PhaseStage;
