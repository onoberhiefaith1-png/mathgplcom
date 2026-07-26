// Teacher — Group Bars panel for the Adventure Dashboard. Each group owns one
// Progress Bar and races only its own students against the class-wide time.
// "Whole Class" is the implicit group of students not assigned anywhere else.

import { useMemo, useState } from "react";
import { Plus, Trash2, Users, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  assignStudentToGroup,
  createGroup,
  deleteGroup,
  renameGroup,
  type AdventureGroup,
} from "@/lib/adventures/groups";
import type { AdventureBarSummary } from "@/hooks/useAdventureSync";
import type { GroupContext } from "@/hooks/useAdventureGroups";

type Member = { user_id: string; display_name: string };

interface Props {
  classId: string;
  gameId: string;
  members: Member[];
  bars: AdventureBarSummary[];
  ctx: GroupContext;
  /** Optional per-bar stats for group-owned bars (scoped to group members). */
  statsByBar: Map<string, AdventureBarSummary>;
  /** Bar element ids already spoken for (Time Bar, or linked to a lesson via LinkAdventureDialog). */
  reservedBarIds?: Set<string>;
}

export function GroupsPanel({ classId, gameId, members, bars, ctx, statsByBar, reservedBarIds }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBarId, setNewBarId] = useState("");

  const usedBarIds = useMemo(() => new Set(ctx.groups.map((g) => g.progress_element_id)), [ctx.groups]);
  const availableBars = useMemo(
    () => bars.filter((b) => !usedBarIds.has(b.id) && !(reservedBarIds?.has(b.id))),
    [bars, usedBarIds, reservedBarIds],
  );

  const wholeClassStudents = useMemo(
    () => members.filter((m) => !ctx.studentGroup.has(m.user_id)),
    [members, ctx.studentGroup],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const doCreate = async () => {
    if (!newName.trim() || !newBarId) return;
    try {
      await createGroup(classId, gameId, newName.trim(), newBarId);
      setNewName(""); setNewBarId(""); setCreating(false);
      await ctx.refresh();
    } catch (e) {
      toast({ title: "Could not create group", description: (e as Error).message, variant: "destructive" });
    }
  };

  const doDelete = async (g: AdventureGroup) => {
    if (!confirm(`Delete "${g.name}"? Students return to Whole Class.`)) return;
    try {
      await deleteGroup(g.id);
      await ctx.refresh();
    } catch (e) {
      toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" });
    }
  };

  const doRename = async (g: AdventureGroup) => {
    const name = prompt("Rename group:", g.name);
    if (!name || name.trim() === g.name) return;
    try { await renameGroup(g.id, name.trim()); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not rename", description: (e as Error).message, variant: "destructive" }); }
  };

  const moveStudent = async (studentId: string, groupId: string | null) => {
    try { await assignStudentToGroup(classId, gameId, studentId, groupId); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not assign", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Group Bars
        </div>
        {!creating && availableBars.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New Group
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-lg border border-border bg-card/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name (e.g. Team Alpha)"
              className="h-8 rounded border border-input bg-background px-2 text-sm"
            />
            <select
              value={newBarId}
              onChange={(e) => setNewBarId(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm"
            >
              <option value="">Choose a progress bar…</option>
              {availableBars.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(""); setNewBarId(""); }}>Cancel</Button>
            <Button size="sm" onClick={doCreate} disabled={!newName.trim() || !newBarId}>Create</Button>
          </div>
        </div>
      )}

      <GroupCard
        title="Whole Class"
        subtitle="Students not in any group"
        studentCount={wholeClassStudents.length}
        studentNames={wholeClassStudents.map((m) => m.display_name)}
        stats={null}
      />

      {ctx.groups.map((g) => {
        const bar = bars.find((b) => b.id === g.progress_element_id);
        const stats = statsByBar.get(g.progress_element_id) ?? null;
        const groupMemberIds = Array.from(ctx.studentsByGroup.get(g.id) ?? []);
        const groupMembers = groupMemberIds.map((id) => memberById.get(id)).filter(Boolean) as Member[];
        return (
          <GroupCard
            key={g.id}
            title={g.name}
            subtitle={bar ? `Bar: ${bar.label}` : "Bar removed"}
            studentCount={groupMembers.length}
            studentNames={groupMembers.map((m) => m.display_name)}
            stats={stats}
            onRename={() => doRename(g)}
            onDelete={() => doDelete(g)}
            onRemoveStudent={(sid) => moveStudent(sid, null)}
            studentRows={groupMembers}
            addPool={wholeClassStudents}
            onAddStudent={(sid) => moveStudent(sid, g.id)}
          />
        );
      })}

      {ctx.groups.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground">
          Create a group to split the class. Each group races on its own progress bar.
        </p>
      )}
    </div>
  );
}

function GroupCard({
  title, subtitle, studentCount, studentNames, stats,
  onRename, onDelete, onRemoveStudent, studentRows, addPool, onAddStudent,
}: {
  title: string;
  subtitle: string;
  studentCount: number;
  studentNames: string[];
  stats: AdventureBarSummary | null;
  onRename?: () => void;
  onDelete?: () => void;
  onRemoveStudent?: (sid: string) => void;
  studentRows?: Member[];
  addPool?: Member[];
  onAddStudent?: (sid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1">
          {onRename && (
            <button type="button" onClick={onRename} className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-accent">Rename</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent" aria-label="Delete group">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <Meta label="Students" value={String(studentCount)} />
        <Meta label="Achieved" value={stats ? `${stats.achieved} / ${stats.required}` : "—"} />
        <Meta label="Per Slot" value={stats ? `${stats.perSlot}` : "—"} />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {expanded ? "Hide" : "Show"} students ({studentCount})
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {studentRows ? (
            <ul className="space-y-1">
              {studentRows.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2 py-1 text-xs">
                  <span className="truncate">{m.display_name}</span>
                  {onRemoveStudent && (
                    <button type="button" onClick={() => onRemoveStudent(m.user_id)} className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent" aria-label="Remove student">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
              {studentRows.length === 0 && <li className="text-[11px] text-muted-foreground">No students yet.</li>}
            </ul>
          ) : (
            <ul className="space-y-1">
              {studentNames.map((n, i) => (
                <li key={i} className="rounded-md border border-border bg-background/40 px-2 py-1 text-xs">{n}</li>
              ))}
              {studentNames.length === 0 && <li className="text-[11px] text-muted-foreground">No students.</li>}
            </ul>
          )}

          {addPool && addPool.length > 0 && onAddStudent && (
            <div className="flex items-center gap-2">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                defaultValue=""
                onChange={(e) => {
                  const sid = e.target.value;
                  if (sid) { onAddStudent(sid); e.target.value = ""; }
                }}
                className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs"
              >
                <option value="">Add student from Whole Class…</option>
                {addPool.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-background/40 px-2 py-1">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="tabular-nums text-xs font-semibold">{value}</div>
  </div>
);
