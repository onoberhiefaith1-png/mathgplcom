// Mathematical Tables picker — a "Table of Contents" dialog.
//
// Each item expands inline to show the table's valid range and an
// input + Generate button. When the teacher clicks Generate, we
// resolve the entry, compute the row block, and call back with the
// node attributes that the editor should insert.

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TABLE_CATALOG, SECTION_LABELS, type TableEntry } from "@/lib/tables/catalog";
import type { MathTableAttrs } from "@/components/lessonnotes/extensions/MathTable";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (attrs: MathTableAttrs) => void;
}

export function MathTablesPicker({ open, onOpenChange, onInsert }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (entry: TableEntry) => {
    const raw = inputs[entry.id] ?? "";
    const v = Number(raw);
    if (!Number.isFinite(v)) {
      setErrors((p) => ({ ...p, [entry.id]: "Enter a numeric value." }));
      return;
    }
    const valErr = entry.validate(v);
    if (valErr) {
      setErrors((p) => ({ ...p, [entry.id]: valErr }));
      return;
    }
    setErrors((p) => ({ ...p, [entry.id]: "" }));
    const generated = entry.generate(v);
    onInsert({
      tableId: entry.id,
      tableName: entry.name,
      input: v,
      generated,
      edits: {},
    });
    onOpenChange(false);
  };

  const sectionA = TABLE_CATALOG.filter((t) => t.section === "A");
  const sectionB = TABLE_CATALOG.filter((t) => t.section === "B");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Mathematical Tables
          </DialogTitle>
          <DialogDescription>
            Pick a table, enter a value, then insert the looked-up row into your lesson note.
          </DialogDescription>
        </DialogHeader>

        {[
          { key: "A" as const, items: sectionA },
          { key: "B" as const, items: sectionB },
        ].map(({ key, items }) => (
          <div key={key} className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              {SECTION_LABELS[key]}
            </div>
            <div className="rounded border divide-y">
              {items.map((entry) => {
                const isOpen = expanded === entry.id;
                return (
                  <div key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50",
                        isOpen && "bg-muted/40",
                      )}
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <span className="flex-1">{entry.name}</span>
                      <span className="text-[10px] text-muted-foreground">{entry.rangeLabel}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Value:</span>
                        <Input
                          value={inputs[entry.id] ?? ""}
                          onChange={(e) => setInputs((p) => ({ ...p, [entry.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submit(entry); }}
                          className="h-7 w-32 text-[12px]"
                          placeholder={entry.rangeLabel}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => submit(entry)} className="h-7 text-[11px]">
                          Generate
                        </Button>
                        {errors[entry.id] && (
                          <span className="text-[11px] text-red-600 w-full">{errors[entry.id]}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
