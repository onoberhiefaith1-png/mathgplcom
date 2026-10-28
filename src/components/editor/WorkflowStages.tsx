import { StagePanel } from "./StagePanel";
import { AudioStage } from "./stages/AudioStage";
import { ParaphraseStage } from "./stages/ParaphraseStage";
import { TranscriptStage } from "./stages/TranscriptStage";
import { LanguageStage } from "./stages/LanguageStage";
import { VoiceStage } from "./stages/VoiceStage";
import { TimingStage } from "./stages/TimingStage";
import { SubtitlesStage } from "./stages/SubtitlesStage";
import { FinalPreviewStage } from "./stages/FinalPreviewStage";
import { PublishStage } from "./stages/PublishStage";
import { visibleStages, type StageId } from "@/lib/editor/workflow";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";
import type { Segment } from "@/lib/editor/types";

interface Props {
  wf: WorkflowApi;
  tlTime: number;
  onSeek: (time: number) => void;
  clipCount: number;
  onSave: () => void;
  videoSrc: string;
  segments: Segment[];
  duration: number;
}

export function WorkflowStages({
  wf,
  tlTime,
  onSeek,
  clipCount,
  onSave,
  videoSrc,
  segments,
  duration,
}: Props) {
  const navigate = (id: StageId) => {
    wf.goTo(id);
    document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3">
      {visibleStages(wf.state).map((stage, index, list) => {
        const status = wf.statusOf(stage.id);
        const current = wf.state.current === stage.id;
        const progress = wf.busy === stage.id ? wf.progress : undefined;

        const common = {
          stage,
          ordinal: index + 1,
          previousId: list[index - 1]?.id,
          status,
          current,
          progress,
          onNavigate: navigate,
          onApprove: () => wf.approve(stage.id),
          blockers: wf.blockersFor(stage.id),
          onProceedAnyway: () => wf.proceedAnyway(stage.id),
        };

        if (stage.id === 1) {
          return (
            <StagePanel key={stage.id} {...common}>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Editing is optional. Approve straight away to work from the uploaded video exactly
                  as it is, or cut, trim, split and reorder on the timeline above first — whatever
                  you approve here becomes the source of truth for every later stage.
                </p>
                <p className="text-xs text-muted-foreground">
                  The uploaded file itself is never modified: cuts are stored as an edit list, so you
                  can always come back and change them.
                </p>
              </div>
            </StagePanel>
          );
        }
        if (stage.id === 2) {
          return (
            <StagePanel key={stage.id} {...common}>
              <AudioStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 3) {
          return (
            <StagePanel key={stage.id} {...common}>
              <TranscriptStage wf={wf} tlTime={tlTime} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 4) {
          return (
            <StagePanel key={stage.id} {...common}>
              <ParaphraseStage wf={wf} />
            </StagePanel>
          );
        }

        if (stage.id === 5) {
          return (
            <StagePanel key={stage.id} {...common}>
              <LanguageStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 6) {
          return (
            <StagePanel key={stage.id} {...common}>
              <VoiceStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 7) {
          return (
            <StagePanel key={stage.id} {...common}>
              <TimingStage wf={wf} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 8) {
          return (
            <StagePanel key={stage.id} {...common}>
              <SubtitlesStage wf={wf} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 9) {
          return (
            <StagePanel key={stage.id} {...common}>
              <FinalPreviewStage
                wf={wf}
                videoSrc={videoSrc}
                segments={segments}
                duration={duration}
              />
            </StagePanel>
          );
        }
        return (
          <StagePanel key={stage.id} {...common} approveLabel="Finish">
            <PublishStage wf={wf} onSave={onSave} />
          </StagePanel>
        );
      })}

    </div>
  );
}
