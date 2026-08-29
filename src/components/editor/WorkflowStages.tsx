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
        };

        if (stage.id === 1) {
          return (
            <StagePanel key={stage.id} {...common} canApprove={clipCount > 0}>
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
            <StagePanel key={stage.id} {...common} canApprove={Boolean(wf.state.audio)}>
              <AudioStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 3) {
          return (
            <StagePanel key={stage.id} {...common} canApprove={wf.state.transcript.length > 0}>
              <TranscriptStage wf={wf} tlTime={tlTime} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 4) {
          return (
            <StagePanel
              key={stage.id}
              {...common}
              canApprove={wf.state.paraphrase.length > 0 && wf.staleParaphraseIds.length === 0}
            >
              <ParaphraseStage wf={wf} />
            </StagePanel>
          );
        }

        if (stage.id === 5) {
          return (
            <StagePanel key={stage.id} {...common} canApprove={wf.state.transcript.length > 0}>
              <LanguageStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 6) {
          return (
            <StagePanel
              key={stage.id}
              {...common}
              canApprove={Object.keys(wf.state.voice).length > 0 && wf.pendingVoiceIds.length === 0}
            >
              <VoiceStage wf={wf} />
            </StagePanel>
          );
        }
        if (stage.id === 7) {
          return (
            <StagePanel
              key={stage.id}
              {...common}
              canApprove={wf.fits.some((fit) => fit.rawDuration > 0)}
            >
              <TimingStage wf={wf} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 8) {
          return (
            <StagePanel key={stage.id} {...common} canApprove={wf.cues.length > 0}>
              <SubtitlesStage wf={wf} onSeek={onSeek} />
            </StagePanel>
          );
        }
        if (stage.id === 9) {
          return (
            <StagePanel key={stage.id} {...common} canApprove={Boolean(wf.generatedTrack)}>
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
          <StagePanel
            key={stage.id}
            {...common}
            canApprove
            approveLabel="Finish"
          >
            <PublishStage wf={wf} onSave={onSave} />
          </StagePanel>
        );
      })}
    </div>
  );
}
