import { useMemo, useState } from "react";
import { Mic, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DELIVERY_STYLES,
  findVoice,
  voicesForLanguage,
  accentsForLanguage,
} from "@/lib/editor/voice-catalog";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";
import { LanguagePicker } from "../LanguagePicker";

export function VoiceStage({ wf }: { wf: WorkflowApi }) {
  const busy = wf.busy === 6;
  const stale = wf.voiceStaleIds;
  // The spoken language IS the project's target language — the picker below
  // changes it, so the voice list can never drift into another language.
  const language = wf.state.targetLanguage;
  const [accent, setAccent] = useState("all");
  const [gender, setGender] = useState<"all" | "female" | "male">("all");
  const [query, setQuery] = useState("");

  const accents = useMemo(() => accentsForLanguage(language), [language]);

  const filtered = useMemo(
    () =>
      voicesForLanguage(language).filter((v) => {
        if (accent !== "all" && v.accent !== accent) return false;
        if (gender !== "all" && v.gender !== gender) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            v.label.toLowerCase().includes(q) ||
            v.accent.toLowerCase().includes(q) ||
            v.region.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [accent, gender, language, query],
  );

  if (wf.script.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The voice is generated from the approved script — finish the earlier stages first.
      </p>
    );
  }

  const selected = findVoice(wf.state.voiceName);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Only the script text is sent for speech synthesis — never the video. Each segment becomes
        its own clip, keeps its original timing window, and can be regenerated on its own.
      </p>

      {/* Spoken language belongs to audio generation */}
      <LanguagePicker
        value={wf.state.targetLanguage}
        onChange={(next) => {
          wf.setTargetLanguage(next);
          setAccent("all");
        }}
      />

      {wf.translating && wf.untranslatedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          <span className="flex-1">
            {wf.untranslatedIds.length} segment(s) are not translated into {wf.state.targetLanguage}{" "}
            yet. They are translated automatically before the voice is generated.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={wf.busy === 5}
            onClick={() => void wf.runTranslation(wf.untranslatedIds)}
          >
            Translate all remaining
          </Button>
        </div>
      ) : null}

      {wf.voiceMismatchIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
          <span className="flex-1">
            {wf.voiceMismatchIds.length} segment(s) were generated with a different voice than{" "}
            {selected.label}. The lesson would switch voices halfway through.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={busy}
            onClick={() => void wf.enforceDefaultVoice()}
          >
            Re-voice with my default voice
          </Button>
        </div>
      ) : null}

      {Object.keys(wf.state.voiceOverrides).length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
          <span className="flex-1">
            {Object.keys(wf.state.voiceOverrides).length} segment(s) use a different voice or style
            than the rest of the lesson.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={wf.clearVoiceOverrides}
          >
            Use one voice everywhere
          </Button>
        </div>
      ) : null}

      {/* Voice library */}
      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            Accent (inside {language})
            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All accents</option>
              {accents.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Gender
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">Any</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="relative min-w-[160px] flex-1 text-xs text-muted-foreground">
            Search
            <Search className="pointer-events-none absolute bottom-2.5 left-2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name or accent"
              className="mt-1 h-9 pl-7"
            />
          </label>
        </div>

        <ul className="mt-3 grid max-h-[190px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((voice) => {
            const active = voice.id === wf.state.voiceName;
            return (
              <li key={voice.id}>
                <button
                  type="button"
                  onClick={() => wf.setVoiceName(voice.id)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary/60"
                  }`}
                >
                  <span className="block font-medium">
                    {voice.label} · {voice.gender === "female" ? "♀" : "♂"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {voice.accent} — {voice.region}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="text-xs text-muted-foreground">No voice matches those filters.</li>
          ) : null}
        </ul>

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Selected: <span className="text-foreground">{selected.label}</span> — {selected.accent},{" "}
          {selected.region}. Accents are produced by steering the speech engine, so major variants
          are close to native and smaller languages are approximate.
        </p>
      </div>

      {/* Delivery style */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Delivery style
          <select
            value={wf.state.deliveryStyle}
            onChange={(e) => wf.setDeliveryStyle(e.target.value)}
            className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {DELIVERY_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-xs text-muted-foreground">
          Extra delivery notes (optional)
          <Input
            value={wf.state.voiceInstructions}
            onChange={(e) => wf.setVoiceInstructions(e.target.value)}
            placeholder="pause slightly before each formula"
            className="mt-1 h-9"
          />
        </label>
        <Button size="sm" onClick={() => void wf.runVoice()} disabled={busy}>
          <Mic className="mr-1.5 size-4" />
          {wf.pendingVoiceIds.length > 0
            ? `Generate ${wf.pendingVoiceIds.length} pending segment${wf.pendingVoiceIds.length === 1 ? "" : "s"}`
            : "Generate voice"}
        </Button>
        {Object.keys(wf.state.voice).length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void wf.runVoice(wf.script.map((item) => item.id))}
          >
            Force regenerate everything
          </Button>
        ) : null}
        <span className="text-[11px] text-muted-foreground">
          Segments that already fit their original spoken time are accepted and never regenerated.
        </span>
      </div>

      <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {wf.script.map((item) => {
          const meta = wf.state.voice[item.id];
          const url = wf.voiceUrls[item.id];
          const segment = wf.state.transcript.find((t) => t.id === item.id);
          const status = wf.voiceStatus[item.id];
          const isStale = stale.includes(item.id);
          const override = wf.state.voiceOverrides[item.id];
          return (
            <li key={item.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {segment
                    ? `${formatTimecode(segment.start, false)} → ${formatTimecode(segment.end, false)} · window ${(segment.end - segment.start).toFixed(2)}s`
                    : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {meta
                    ? `${meta.duration.toFixed(2)}s · ${findVoice(meta.voice).label}`
                    : `Not generated · will use ${selected.label}`}
                </span>
              </div>

              {wf.voiceMismatchIds.includes(item.id) ? (
                <p className="mt-1 text-[10px] text-destructive">
                  Different voice than the lesson default — regenerate this segment.
                </p>
              ) : null}

              <Textarea
                value={item.text}
                onChange={(e) => wf.setScriptText(item.id, e.target.value)}
                className="mt-1 min-h-[52px] resize-y text-sm"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={override?.voice ?? ""}
                  onChange={(e) => wf.setSegmentVoice(item.id, e.target.value || null)}
                  className="h-8 rounded-md border border-input bg-background px-1.5 text-[11px]"
                >
                  <option value="">Voice: default</option>
                  {voicesForLanguage(language).map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label} — {voice.accent}
                    </option>
                  ))}
                </select>
                <select
                  value={override?.style ?? ""}
                  onChange={(e) => wf.setSegmentStyle(item.id, e.target.value || null)}
                  className="h-8 rounded-md border border-input bg-background px-1.5 text-[11px]"
                >
                  <option value="">Style: default</option>
                  {DELIVERY_STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant={meta ? "outline" : "default"}
                  className="h-8"
                  disabled={status?.state === "generating"}
                  onClick={() => void wf.runVoice([item.id])}
                >
                  {status?.state === "generating"
                    ? "Generating…"
                    : meta
                      ? "Regenerate"
                      : "Generate"}
                </Button>
                {url ? <audio controls src={url} className="h-8 max-w-full" /> : null}
                {isStale && meta ? (
                  <span className="text-[10px] text-destructive">Out of date</span>
                ) : null}
              </div>

              {status?.state === "error" ? (
                <p className="mt-1 text-[10px] text-destructive">{status.error}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
