// Phase 3 — one platform action Aura carried out, shown as a compact card the
// teacher can open to see exactly what happened.

import {
  BookOpen,
  Compass,
  Gamepad2,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { findAgentTool } from "@/lib/agent/toolTypes";
import type { AgentStep } from "@/lib/agent/brain.server";

const DOMAIN_ICON: Record<string, LucideIcon> = {
  workspace: LayoutDashboard,
  classes: Users,
  lessonNotes: BookOpen,
  games: Gamepad2,
  navigation: Compass,
};

function title(step: AgentStep) {
  return step.toolId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function AuraStepCard({ step }: { step: AgentStep }) {
  const spec = findAgentTool(step.toolId);
  const Icon = DOMAIN_ICON[spec?.domain ?? "workspace"] ?? LayoutDashboard;

  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-3 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <Tool defaultOpen={false} className="min-w-0 flex-1 border-border/60">
        <ToolHeader
          type="dynamic-tool"
          toolName={step.toolId}
          title={title(step)}
          state={step.ok ? "output-available" : "output-error"}
        />
        <ToolContent>
          <ToolOutput
            output={step.ok ? <span className="text-xs">{step.summary}</span> : undefined}
            errorText={step.ok ? undefined : step.summary}
          />
        </ToolContent>
      </Tool>
    </div>
  );
}
