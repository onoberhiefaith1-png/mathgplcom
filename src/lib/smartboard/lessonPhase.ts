// Lesson Phase — the instructional state that drives the Smartboard.
//
// The lesson note is the brain. Each beat the teacher advances through maps
// to ONE phase, and each phase carries a capability contract that tells the
// board what to show, what to allow, and how to transition.
//
// Nothing here generates math. Phases only gate visibility and interaction
// over content that already lives in the notebook.

import type { Beat } from "./presentation";

export type LessonPhase =
  | "cover"            // title / topic / subtopic / date
  | "topic"            // subtopic hidden, topic only
  | "introduction"
  | "explanation"
  | "example-question" // pre-solution: question visible, shell hidden
  | "example-step"     // mid-solution: shell active, floating math live
  | "guided"           // classwork
  | "exercise"
  | "homework"
  | "summary";

export interface PhaseCapabilities {
  /** Show the interaction shell (floating numbers / structures / operators). */
  showFloatingShell: boolean;
  /** Show the legacy floating math drawer (top-bar toggle). */
  showFloatingMath: boolean;
  /** Allow free-writing on the surface. */
  allowInk: boolean;
  /** Allow pointer interaction with notebook beats / shell. */
  allowInteraction: boolean;
  /** Visual mood — drives ambient overlay tint + chrome subtleties. */
  chromeMood: "calm" | "active" | "collab" | "quiet";
  /** Transition style used when entering this phase. */
  transition: "fade" | "expand" | "cinematic";
}

export const getPhase = (beat: Beat | undefined): LessonPhase => {
  if (!beat) return "cover";
  // Synthetic cover beat (see presentation.ts).
  if (beat.id === "__cover__") return "cover";


  switch (beat.sectionKind) {
    case "introduction": return "introduction";
    case "explanation":  return "explanation";
    case "summary":      return "summary";
    case "example":
      return beat.kind === "problem" ? "example-question" : "example-step";
    case "classwork":    return "guided";
    case "exercise":     return "exercise";
    case "homework":     return "homework";
    default:             return "explanation";
  }
};

const CAPS: Record<LessonPhase, PhaseCapabilities> = {
  cover:            { showFloatingShell: false, showFloatingMath: false, allowInk: false, allowInteraction: false, chromeMood: "calm",   transition: "cinematic" },
  topic:            { showFloatingShell: false, showFloatingMath: false, allowInk: false, allowInteraction: false, chromeMood: "calm",   transition: "fade"      },
  introduction:     { showFloatingShell: false, showFloatingMath: false, allowInk: false, allowInteraction: false, chromeMood: "calm",   transition: "fade"      },
  explanation:      { showFloatingShell: false, showFloatingMath: true,  allowInk: true,  allowInteraction: true,  chromeMood: "calm",   transition: "fade"      },
  "example-question":{ showFloatingShell: false, showFloatingMath: true,  allowInk: true,  allowInteraction: true,  chromeMood: "active", transition: "expand"    },
  "example-step":   { showFloatingShell: true,  showFloatingMath: true,  allowInk: true,  allowInteraction: true,  chromeMood: "active", transition: "expand"    },
  guided:           { showFloatingShell: true,  showFloatingMath: true,  allowInk: true,  allowInteraction: true,  chromeMood: "collab", transition: "expand"    },
  exercise:         { showFloatingShell: true,  showFloatingMath: true,  allowInk: true,  allowInteraction: true,  chromeMood: "collab", transition: "expand"    },
  homework:         { showFloatingShell: false, showFloatingMath: false, allowInk: false, allowInteraction: false, chromeMood: "quiet",  transition: "fade"      },
  summary:          { showFloatingShell: false, showFloatingMath: false, allowInk: false, allowInteraction: false, chromeMood: "quiet",  transition: "cinematic" },
};

export const phaseCapabilities = (phase: LessonPhase): PhaseCapabilities => CAPS[phase];
