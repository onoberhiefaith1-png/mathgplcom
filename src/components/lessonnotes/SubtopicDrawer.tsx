import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Subtopic } from "@/lib/lessonnotes/subtopics";

interface Props {
  topic: string;
  subtopics: Subtopic[];
  activeId: string | null;
  readOnly?: boolean;
  topOffset?: number;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
}

/** Collapsible list of the subtopics inside one Topic note. */
export const SubtopicDrawer = ({ topic, subtopics, activeId, readOnly, topOffset = 0, onClose, onSelect, onAdd, onRename, onMove, onDelete }: Props) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const submit = () => {
    const n = name.trim();
    if (n) onAdd(n);
    setName("");
    setAdding(false);
  };

  return (
    <aside style={{ paddingTop: topOffset }} className="h-full w-64 shrink-0 border-r border-border bg-card/95 flex flex-col" aria-label="Subtopics">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Topic</p>
          <p className="truncate text-sm font-semibold">{topic || "Untitled"}</p>
        </div>
        {!readOnly && (
          <Button size="icon" variant="outline" className="h-8 w-8" title="Add subtopic" aria-label="Add subtopic" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Close" aria-label="Close subtopics" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-1">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Addition of Surds" className="h-8 text-sm" onBlur={submit} />
          </form>
        )}
        {subtopics.length === 0 && !adding && (
          <p className="px-2 py-4 text-xs text-muted-foreground">No subtopics yet. Press + to add one.</p>
        )}
        {subtopics.map((s, i) => (
          <div key={s.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${s.id === activeId ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {editing === s.id ? (
              <form className="flex-1" onSubmit={(e) => { e.preventDefault(); if (editName.trim()) onRename(s.id, editName.trim()); setEditing(null); }}>
                <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" onBlur={() => setEditing(null)} />
              </form>
            ) : (
              <button className="flex-1 truncate text-left" onClick={() => onSelect(s.id)}>{s.name}</button>
            )}
            {!readOnly && editing !== s.id && (
              <span className="flex items-center">
                <button aria-label="Move up" disabled={i === 0} onClick={() => onMove(s.id, -1)} className="p-0.5 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button aria-label="Move down" disabled={i === subtopics.length - 1} onClick={() => onMove(s.id, 1)} className="p-0.5 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button aria-label="Rename" onClick={() => { setEditing(s.id); setEditName(s.name); }} className="p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
                <button aria-label="Delete" onClick={() => { if (window.confirm(`Delete "${s.name}" and its pages?`)) onDelete(s.id); }} className="p-0.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};
