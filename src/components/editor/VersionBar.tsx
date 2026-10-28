import { useMemo, useState } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DELIVERY_STYLES,
  DEFAULT_STYLE_ID,
  VOICE_CATALOG,
  VOICE_LANGUAGES,
} from "@/lib/editor/voice-catalog";
import { ORIGINAL_BRANCH } from "@/lib/editor/workflow";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

/**
 * The optional language branch. The original version is always present; every
 * extra version reuses the same uploaded video and only owns its own script,
 * voice, timing, subtitles and final mix.
 */
export function VersionBar({ wf }: { wf: WorkflowApi }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("French");
  const [region, setRegion] = useState("any");
  const [style, setStyle] = useState(DEFAULT_STYLE_ID);

  const voices = useMemo(
    () =>
      VOICE_CATALOG.filter(
        (v) => v.language === language && (region === "any" || v.region === region),
      ),
    [language, region],
  );
  const regions = useMemo(
    () =>
      Array.from(new Set(VOICE_CATALOG.filter((v) => v.language === language).map((v) => v.region))),
    [language],
  );
  const [voice, setVoice] = useState<string>("");
  const chosenVoice = voices.find((v) => v.id === voice)?.id ?? voices[0]?.id ?? "";

  return (
    <div className="sticky top-[52px] z-20 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Globe className="size-3.5" />
        Versions
      </span>

      <VersionChip
        label="English — Original"
        active={wf.activeBranch === ORIGINAL_BRANCH}
        onClick={() => wf.switchBranch(ORIGINAL_BRANCH)}
      />
      {wf.branches.map((branch) => (
        <VersionChip
          key={branch.id}
          label={branch.language}
          active={wf.activeBranch === branch.id}
          onClick={() => wf.switchBranch(branch.id)}
          onDelete={() => wf.deleteBranch(branch.id)}
        />
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">
            <Plus className="mr-1 size-3.5" />
            Add Language Version
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a language version</DialogTitle>
            <DialogDescription>
              The same original video is reused — only the script, voice, timing and subtitles are
              new.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Language">
              <Select
                value={language}
                onValueChange={(value) => {
                  setLanguage(value);
                  setRegion("any");
                  setVoice("");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Country / region">
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any region</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Voice & accent">
              <Select value={chosenVoice} onValueChange={setVoice}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label} · {v.accent} · {v.gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Delivery style">
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button
              disabled={!chosenVoice}
              onClick={() => {
                wf.addLanguageVersion({ language, voice: chosenVoice, style });
                setOpen(false);
              }}
            >
              Create {language} version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionChip({
  label,
  active,
  onClick,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      <button type="button" onClick={onClick} className="font-medium">
        {label}
      </button>
      {onDelete ? (
        <button type="button" onClick={onDelete} aria-label={`Delete ${label} version`}>
          <Trash2 className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
