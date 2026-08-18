// Bulk emoji entry for the official Emoji session. A pasted run of emojis
// becomes one asset per glyph — never a single combined asset. Grapheme
// clustering keeps family/skin-tone/flag sequences whole.

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Splits a string into visible glyphs, dropping whitespace and separators. */
export const splitGlyphs = (value: string): string[] => {
  const raw: string[] = [];
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: "grapheme" });
    for (const part of seg.segment(value)) raw.push(part.segment);
  } else {
    raw.push(...Array.from(value));
  }
  return raw
    .map((g) => g.trim())
    .filter((g) => g.length > 0 && !/^[\s,;|]+$/.test(g));
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Saves one asset per glyph, in order. */
  onSave: (glyphs: string[]) => Promise<void>;
}

const EmojiGlyphBulkDialog = ({ open, onClose, onSave }: Props) => {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const glyphs = useMemo(() => splitGlyphs(text), [text]);

  const close = () => {
    if (saving) return;
    setText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add emojis</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="emoji-bulk">Type or paste emojis</Label>
          <Textarea
            id="emoji-bulk"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="😀 😂 ❤️ ⭐ 🔥 🎯"
            className="min-h-[96px] text-2xl leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Each emoji becomes its own asset and appears in the Lesson Note editor and both
            Smartboard emoji panels.
          </p>

          {glyphs.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {glyphs.length} emoji{glyphs.length === 1 ? "" : "s"} will be added
              </p>
              <div className="flex flex-wrap gap-2 text-2xl">
                {glyphs.map((g, i) => (
                  <span key={`${g}-${i}`} className="rounded-md bg-muted px-2 py-1">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={saving} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            className="min-h-[44px] gap-2"
            disabled={saving || glyphs.length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(glyphs);
                setText("");
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {glyphs.length || ""} emoji{glyphs.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmojiGlyphBulkDialog;
