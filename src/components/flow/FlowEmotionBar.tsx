// Flow Emotion control: one compact, freely movable row of emotion buttons.
import { Button } from "@/components/ui/button";

interface Props {
  emotions: { id: string; label: string }[];
  queued: number;
  onPick: (id: string) => void;
  backgroundColor?: string;
}

export const FlowEmotionBar = ({ emotions, queued, onPick, backgroundColor }: Props) => {
  if (!emotions.length) return null;
  return (
    <div
      data-sb-chrome
      className="flex w-full flex-wrap items-center justify-center gap-0.5 rounded-full border border-border px-1.5 py-1 shadow backdrop-blur"
      style={{ backgroundColor: backgroundColor ?? "hsl(var(--background) / 0.8)" }}
    >
      {emotions.map((e) => (
        <Button
          key={e.id}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPick(e.id)}
          title={e.label}
          className="h-7 whitespace-nowrap rounded-full px-1.5 text-base leading-none"
        >
          {e.label}
        </Button>
      ))}
      {queued > 0 && <span className="px-1 text-[10px] text-muted-foreground">+{queued}</span>}
    </div>
  );
};

export default FlowEmotionBar;
