// GeometryGuideView — the student-facing, read-only Geometry Guide.
// Shows only approved, enabled relationships in the categories the teacher
// published. No AI, no editing, no authoring controls.

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import {
  PROPERTY_KINDS,
  connectionsOf,
  describeTarget,
  guideTargets,
  readProperties,
  resolveHighlightIds,
  type GeometryPropertiesDoc,
  type GeometryPropertyItem,
} from "@/lib/geometry/properties/model";

export function GeometryGuideView({
  scene, onHighlight,
}: {
  scene: GeometryScene;
  /** Highlights the relationship's objects on the diagram above. */
  onHighlight?: (ids: string[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const doc = readProperties(scene);
  const [open, setOpen] = useState(false);

  if (!doc.published || doc.access === "off") return null;

  const visible = doc.items
    .filter((i) => i.approved !== false && i.enabled !== false && i.content.trim())
    .filter((i) =>
      doc.access === "both" ? true : i.category === doc.access,
    )
    .sort((a, b) => a.order - b.order);

  if (visible.length === 0) return null;

  const pick = (item: GeometryPropertyItem) => {
    const next = activeId === item.id ? null : item.id;
    setActiveId(next);
    onHighlight?.(next ? resolveHighlightIds(doc, connectionsOf(item)) : []);
  };

  // Every part of the diagram the teacher attached something to. Choosing one
  // shows only what belongs to it — "click a part, see its relationships".
  const parts = guideTargets(scene, doc, visible);
  const pickPart = (id: string | null) => {
    setPartId(id);
    setActiveId(null);
    onHighlight?.(id ? resolveHighlightIds(doc, [id]) : []);
  };

  const forPart = partId
    ? visible.filter(
        (i) => i.sourceObjectIds.includes(partId) || i.connectedObjectIds.includes(partId),
      )
    : visible;
  const specific = forPart.filter((i) => i.category === "specific");
  const general = forPart.filter((i) => i.category === "general");

  return (
    <div className="mt-2 rounded-lg border border-foreground/15 bg-foreground/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] font-medium"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <BookOpen className="h-3.5 w-3.5 opacity-70" />
        Geometry guide
        <span className="ml-1 text-[11px] font-normal text-foreground/50">
          ({visible.length})
        </span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-foreground/10 px-2.5 py-2">
          {parts.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <Chip label="All" active={partId === null} onClick={() => pickPart(null)} />
              {parts.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  active={partId === p.id}
                  onClick={() => pickPart(partId === p.id ? null : p.id)}
                />
              ))}
            </div>
          )}
          {specific.length > 0 && (
            <Section
              title="In this question" scene={scene} doc={doc} items={specific}
              activeId={activeId} onPick={pick}
            />
          )}
          {general.length > 0 && (
            <Section
              title="General rules" scene={scene} doc={doc} items={general}
              activeId={activeId} onPick={pick}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, items, scene, doc, activeId, onPick,
}: {
  title: string;
  items: GeometryPropertyItem[];
  scene: GeometryScene;
  doc: GeometryPropertiesDoc;
  activeId: string | null;
  onPick: (item: GeometryPropertyItem) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
        {title}
      </p>
      {items.map((item) => {
        const kind = PROPERTY_KINDS.find((k) => k.value === item.kind)?.label ?? "Statement";
        const names = connectionsOf(item)
          .map((id) => describeTarget(scene, doc, id)?.name)
          .filter(Boolean) as string[];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            className={`block w-full rounded border p-2 text-left transition-colors ${
              activeId === item.id
                ? "border-primary bg-primary/10"
                : "border-foreground/10 bg-background/70 hover:bg-foreground/[0.04]"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-foreground/45">{kind}</p>
            <p className="text-[12.5px] leading-snug">{item.content}</p>
            {names.length > 0 && (
              <p className="mt-0.5 text-[10.5px] text-foreground/50">{names.join(" · ")}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10.5px] ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/20 hover:bg-foreground/[0.05]"
      }`}
    >
      {label}
    </button>
  );
}

export default GeometryGuideView;
