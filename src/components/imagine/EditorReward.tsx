import { useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditorReward({ id, art, label, opacity, selected, onSelect, onRemove }: {
  id: string; art: string; label: string; opacity: number; selected: boolean;
  onSelect: () => void; onRemove: () => void;
}) {
  const lastTap = useRef<number | null>(null);
  return <div className="relative w-16 shrink-0" onClick={(event) => event.stopPropagation()}>
    <Button type="button" variant="ghost" size="icon-sm"
      className="pointer-events-auto touch-manipulation p-0 hover:bg-transparent"
      aria-label={`Select ${label} reward`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => { event.stopPropagation(); onSelect(); }}
      onPointerUp={(event) => {
        if (event.pointerType !== "touch") return;
        const now = performance.now();
        if (lastTap.current !== null && now - lastTap.current < 400) {
          onSelect(); lastTap.current = null;
        } else lastTap.current = now;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
      }}
    ><img data-reward={id} src={art} alt="" className="h-8 w-8 object-contain" style={{ opacity }} /></Button>
    {selected ? <Button type="button" variant="destructive" size="icon-sm"
      className="pointer-events-auto absolute right-0 top-0 z-10 rounded-full"
      aria-label={`Remove ${label} reward`} title="Remove reward"
      onClick={(event) => { event.stopPropagation(); onRemove(); }}><X /></Button> : null}
  </div>;
}