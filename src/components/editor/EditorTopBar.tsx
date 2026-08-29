import { ArrowLeft, Download, Eye, Redo2, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TopBarProps {
  title: string;
  onTitleChange: (value: string) => void;
  status: string;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPreview: () => void;
  onBack: () => void;
}

export function EditorTopBar(props: TopBarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={props.onBack} className="shrink-0">
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Course
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={props.title}
            onChange={(e) => props.onTitleChange(e.target.value)}
            className="h-8 max-w-xs border-transparent bg-transparent text-sm font-medium hover:border-border focus-visible:border-border"
            aria-label="Video title"
          />
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {props.status}
            {props.dirty ? " · unsaved changes" : ""}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconAction label="Undo" onClick={props.onUndo} disabled={!props.canUndo}>
            <Undo2 className="size-4" />
          </IconAction>
          <IconAction label="Redo" onClick={props.onRedo} disabled={!props.canRedo}>
            <Redo2 className="size-4" />
          </IconAction>
          <Button variant="ghost" size="sm" onClick={props.onPreview}>
            <Eye className="mr-1.5 size-4" />
            Preview
          </Button>
          <Button size="sm" onClick={props.onSave}>
            <Save className="mr-1.5 size-4" />
            Save
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" disabled>
                  <Download className="mr-1.5 size-4" />
                  Export
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Export arrives with the final render stage</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClick} disabled={disabled}>
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}