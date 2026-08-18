// GeometryGuideView — the student-facing, read-only Geometry Guide.
// Shows only approved, enabled relationships in the categories the teacher
// published. No AI, no editing, no authoring controls.

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import {
  PROPERTY_KINDS,
  describeObject,
  readProperties,
  type GeometryPropertyItem,
} from "@/lib/geometry/properties/model";

export function GeometryGuideView({ scene }: { scene: GeometryScene }) {
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

  const specific = visible.filter((i) => i.category === "specific");
  const general = visible.filter((i) => i.category === "general");

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
          {specific.length > 0 && (
            <Section title="In this question" scene={scene} items={specific} />
          )}
          {general.length > 0 && (
            <Section title="General rules" scene={scene} items={general} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, items, scene,
}: {
  title: string;
  items: GeometryPropertyItem[];
  scene: GeometryScene;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
        {title}
      </p>
      {items.map((item) => {
        const kind = PROPERTY_KINDS.find((k) => k.value === item.kind)?.label ?? "Statement";
        const names = item.connectedObjectIds
          .map((id) => describeObject(scene, id)?.name)
          .filter(Boolean) as string[];
        return (
          <div key={item.id} className="rounded border border-foreground/10 bg-background/70 p-2">
            <p className="text-[10px] uppercase tracking-wider text-foreground/45">{kind}</p>
            <p className="text-[12.5px] leading-snug">{item.content}</p>
            {names.length > 0 && (
              <p className="mt-0.5 text-[10.5px] text-foreground/50">{names.join(" · ")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default GeometryGuideView;
