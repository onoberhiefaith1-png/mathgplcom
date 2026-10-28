// Everything the teacher has said this turn, on screen: five lines deep, newest
// at the bottom, earlier lines scrolling up, and editable with a tap.

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Everything heard so far in this turn. */
  text: string;
  /** Called when the teacher corrects the words before they are sent. */
  onEdit: (text: string) => void;
  placeholder: string;
};

export function CallTranscript({ text, onEdit, placeholder }: Props) {
  const view = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // New words arrive at the bottom and earlier lines scroll up on their own.
  useEffect(() => {
    if (editing) return;
    const element = view.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [text, editing]);

  useEffect(() => {
    if (editing) box.current?.focus();
  }, [editing]);

  const finish = () => {
    const next = draft.trim();
    if (next !== text.trim()) onEdit(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        ref={box}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            finish();
          }
        }}
        rows={5}
        className="w-full resize-none rounded-md border border-primary/40 bg-background px-2 py-1 text-xs leading-5 text-foreground outline-none"
      />
    );
  }

  return (
    <div
      ref={view}
      role="button"
      tabIndex={0}
      title="Tap to correct what I heard"
      onClick={() => {
        setDraft(text);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setDraft(text);
        setEditing(true);
      }}
      // Five lines of five-line height, scrollable back through the whole turn.
      className="max-h-20 cursor-text overflow-y-auto whitespace-pre-wrap break-words text-left text-xs leading-5 text-muted-foreground"
    >
      {text || placeholder}
    </div>
  );
}
