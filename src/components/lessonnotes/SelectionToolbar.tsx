// Selection Toolbar — Google-Docs / iOS-style quick-action popover that
// appears the moment the teacher highlights any non-empty range in the
// TipTap editor. Powered by @tiptap/extension-bubble-menu.
//
// Buttons: Copy · Cut · Delete · Duplicate · Comment · AI Edit ✨
// AI Edit opens the AiEditPanel (sibling component); the bubble hides
// while the panel is open so it doesn't fight the panel UI.

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Copy, Scissors, Trash2, CopyPlus, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  detectSelectionKindFromSlice,
  type SelectionKind,
} from "@/lib/lessonnotes/detectSelectionKind";

export interface SelectionSnapshot {
  from: number;
  to: number;
  text: string;
  json: any;
  kind: SelectionKind;
}

interface Props {
  editor: Editor | null;
  /** Hide the bubble while the AI panel is open. */
  suppressed?: boolean;
  onAiEdit: (snap: SelectionSnapshot) => void;
}

export function SelectionToolbar({ editor, suppressed, onAiEdit }: Props) {
  if (!editor) return null;

  const captureSnapshot = (): SelectionSnapshot | null => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return null;
    const slice = editor.state.doc.slice(from, to);
    // textBetween skips atom math nodes. Use a leafText resolver so MathInline /
    // MathBlock contribute their LaTeX value, otherwise selections that contain
    // only math would send an empty selectionText to the edge function.
    const text = editor.state.doc.textBetween(from, to, "\n", (leaf: any) => {
      const v = leaf?.attrs?.value;
      if (typeof v === "string" && v.length) return v;
      return "";
    });
    const kind = detectSelectionKindFromSlice(slice as any);
    return { from, to, text, json: (slice.content as any).toJSON?.() ?? null, kind };
  };

  const copy = async () => {
    const snap = captureSnapshot();
    if (!snap) return;
    try { await navigator.clipboard.writeText(snap.text); toast({ title: "Copied" }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const cut = async () => {
    const snap = captureSnapshot();
    if (!snap) return;
    try { await navigator.clipboard.writeText(snap.text); } catch { /* noop */ }
    editor.chain().focus().deleteRange({ from: snap.from, to: snap.to }).run();
  };

  const del = () => {
    const snap = captureSnapshot();
    if (!snap) return;
    editor.chain().focus().deleteRange({ from: snap.from, to: snap.to }).run();
  };

  const duplicate = () => {
    const snap = captureSnapshot();
    if (!snap || !snap.json) return;
    const containsAuthoritativeDiagram = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return false;
      const record = value as { type?: string; content?: unknown[] };
      if (record.type === "geometryDiagram") return true;
      return Array.isArray(record.content) && record.content.some(containsAuthoritativeDiagram);
    };
    // One question owns one authoritative geometry scene. It can be copied as
    // data from the diagram's own action row, but never cloned inside the note.
    if (containsAuthoritativeDiagram(snap.json)) {
      toast({ title: "This question already has its diagram" });
      return;
    }
    const fragment = Array.isArray(snap.json) ? snap.json : snap.json?.content ?? null;
    if (!fragment) return;
    editor.chain().focus().insertContentAt(snap.to, fragment).run();
  };

  const comment = () => {
    toast({ title: "Comments coming soon" });
  };

  const handleAiEdit = () => {
    const snap = captureSnapshot();
    if (!snap) return;
    onAiEdit(snap);
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor, state }) => {
        if (suppressed) return false;
        const { empty } = state.selection;
        if (empty) return false;
        if (editor.isActive("codeBlock")) return false;
        return true;
      }}
      className="z-40"
    >
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md border border-foreground/15 bg-popover text-popover-foreground",
          "shadow-md px-1 py-1",
        )}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolBtn label="Copy" onClick={copy}><Copy className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Cut" onClick={cut}><Scissors className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Delete" onClick={del}><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Duplicate" onClick={duplicate}><CopyPlus className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn label="Comment" onClick={comment}><MessageSquare className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px h-4 bg-foreground/15 mx-0.5" />
        <button
          type="button"
          onClick={handleAiEdit}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary"
          title="AI Edit"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Edit
        </button>
      </div>
    </BubbleMenu>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded hover:bg-foreground/10 transition-colors"
    >
      {children}
    </button>
  );
}
