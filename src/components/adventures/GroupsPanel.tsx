// Teacher — Group Bars panel for the Adventure Dashboard.
//
// Default: no groups, one Progress Bar for the whole class.
// First "Add Group" adopts that bar as Group A and puts every student in it.
// Each later "Add Group" duplicates the bar into free space (identical rules).
// A student belongs to exactly one group and can be moved with "Move to".

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  deleteGroup,
  renameGroup,
  assignStudentToGroup,
  styleGroupBar,
  getGroupCompletionMessage,
  setGroupCompletionMessage,
  DEFAULT_GROUP_COMPLETION_MESSAGE,
  MAX_GROUPS,
  type AdventureGroup,
} from "@/lib/adventures/groups";
import { addGroup, backfillUngrouped, defaultSourceBarId, nextGroupName, primaryBarId, groupStatus, GROUP_STATUS_LABEL, type GroupStatus } from "@/lib/adventures/groupCompetition";
import { hasRoomForGroupBar } from "@/lib/adventures/groupBars";
import { adventureModeOf, normalizeCanvas } from "@/lib/games/types";
import type { AdventureBarSummary } from "@/hooks/useAdventureSync";
import type { GroupContext } from "@/hooks/useAdventureGroups";
import type { GameRow } from "@/lib/games/types";

type Member = { user_id: string; display_name: string };

interface Props {
  classId: string;
  gameId: string;
  game: GameRow | null;
  members: Member[];
  bars: AdventureBarSummary[];
  ctx: GroupContext;
  /** Optional per-bar stats for group-owned bars (scoped to group members). */
  statsByBar: Map<string, AdventureBarSummary>;
  /** Bar element ids already spoken for (Time Bar). */
  reservedBarIds?: Set<string>;
  /** Adventure race winner, when one has been decided. */
  winnerGroupId?: string | null;
}

export function GroupsPanel({ classId, gameId, game, members, bars, ctx, statsByBar, reservedBarIds, winnerGroupId }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(DEFAULT_GROUP_COMPLETION_MESSAGE);
  const [savingMessage, setSavingMessage] = useState(false);

  const isVideo = useMemo(
    () => (game ? adventureModeOf(normalizeCanvas(game.canvas)) === "video" : false),
    [game],
  );

  useEffect(() => {
    let cancelled = false;
    void getGroupCompletionMessage(classId, gameId).then((m) => { if (!cancelled) setMessage(m); });
    return () => { cancelled = true; };
  }, [classId, gameId]);

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const timeBarId = useMemo(() => {
    const reserved = Array.from(reservedBarIds ?? []);
    return reserved[0] ?? null;
  }, [reservedBarIds]);

  const playableBarIds = useMemo(
    () => bars.filter((b) => b.id !== timeBarId).map((b) => b.id),
    [bars, timeBarId],
  );

  const sourceBarId = useMemo(
    () => primaryBarId(ctx.groups, defaultSourceBarId(game, playableBarIds, timeBarId)),
    [ctx.groups, game, playableBarIds, timeBarId],
  );

  const roomLeft = useMemo(
    () =>
      ctx.groups.length < MAX_GROUPS &&
      (ctx.groups.length === 0 || hasRoomForGroupBar(game, ctx.groups, sourceBarId)),
    [game, ctx.groups, sourceBarId],
  );

  // No student may sit outside a group once grouping has begun.
  useEffect(() => {
    if (ctx.groups.length === 0 || memberIds.length === 0) return;
    void backfillUngrouped({
      classId,
      gameId,
      groups: ctx.groups,
      memberIds,
      grouped: new Set(ctx.studentGroup.keys()),
    }).then((changed) => { if (changed) void ctx.refresh(); });
  }, [classId, gameId, ctx, memberIds]);

  const doAdd = async () => {
    const suggested = nextGroupName(ctx.groups);
    const name = prompt("Name this group:", suggested);
    if (name === null) return;
    setBusy(true);
    try {
      const res = await addGroup({
        classId, gameId, game, groups: ctx.groups, memberIds, sourceBarId, name: name || suggested,
      });
      if (res.ok === false) {
        const title =
          res.reason === "no_space" ? "No space for another bar"
          : res.reason === "max_groups" ? `Maximum ${MAX_GROUPS} groups`
          : "No Progress Bar found";
        toast({
          title,
          description:
            res.reason === "no_space" ? "Move a bar or remove a group to make room."
            : res.reason === "max_groups" ? "Remove a group before adding another."
            : "Link this Adventure to a lesson question first.",
          variant: "destructive",
        });
        return;
      }
      await ctx.refresh();
      toast({
        title: `${res.group.name} created`,
        description: res.adopted
          ? "The existing Progress Bar now belongs to this group and every student joined it."
          : "An identical Progress Bar was placed in free space.",
      });
    } catch (e) {
      toast({ title: "Could not add group", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (g: AdventureGroup) => {
    if (!confirm(`Delete "${g.name}"? Its students move to the first group.`)) return;
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

  const moveStudent = async (studentId: string, groupId: string) => {
    try { await assignStudentToGroup(classId, gameId, studentId, groupId); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not move", description: (e as Error).message, variant: "destructive" }); }
  };

  const restyle = async (
    g: AdventureGroup,
    style: { color?: string | null; scale?: number | null },
  ) => {
    try { await styleGroupBar(g.id, style); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not restyle", description: (e as Error).message, variant: "destructive" }); }
  };

  const saveMessage = async () => {
    setSavingMessage(true);
    try {
      await setGroupCompletionMessage(classId, gameId, message);
      toast({ title: "Message saved" });
    } catch (e) {
      toast({ title: "Could not save message", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingMessage(false);
    }
  };

  const ungrouped = members.filter((m) => !ctx.studentGroup.has(m.user_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Group Bars
        </div>
        {roomLeft && (
          <Button size="sm" variant="outline" onClick={doAdd} disabled={busy || !sourceBarId}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Group
          </Button>
        )}
      </div>

      {ctx.groups.length === 0 && (
        <GroupCard
          title="Whole Class"
          subtitle="One Progress Bar for everyone"
          studentRows={ungrouped}
          stats={sourceBarId ? statsByBar.get(sourceBarId) ?? null : null}
          groups={[]}
        />
      )}

      {ctx.groups.map((g) => {
        const stats = statsByBar.get(g.progress_element_id) ?? null;
        const ids = Array.from(ctx.studentsByGroup.get(g.id) ?? []);
        const rows = ids.map((id) => memberById.get(id)).filter(Boolean) as Member[];
        return (
          <GroupCard
            key={g.id}
            title={g.name}
            subtitle={g.is_primary ? "Original Progress Bar" : "Duplicated Progress Bar — draggable"}
            studentRows={rows}
            stats={stats}
            groups={ctx.groups}
            currentGroupId={g.id}
            onRename={() => doRename(g)}
            onDelete={ctx.groups.length > 1 ? () => doDelete(g) : undefined}
            onMoveStudent={moveStudent}
            group={g}
            onRestyle={g.is_primary ? undefined : (style) => restyle(g, style)}
            status={groupStatus({
              group: g,
              fill: stats && stats.required > 0 ? stats.achieved / stats.required : 0,
              mode: isVideo ? "video" : "static",
              winnerGroupId,
            })}
          />
        );
      })}

      {isVideo && ctx.groups.length > 0 && (
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Group Completion Message
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Shown to a group that hasn&apos;t reached the target when a Learning Point ends.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-input bg-background p-2 text-xs"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={saveMessage} disabled={savingMessage}>Save message</Button>
            <Button size="sm" variant="ghost" onClick={() => setMessage(DEFAULT_GROUP_COMPLETION_MESSAGE)}>
              Reset
            </Button>
          </div>
        </div>
      )}

      {!roomLeft && (
        <p className="text-xs text-muted-foreground">
          No space left on the stage for another Progress Bar.
        </p>
      )}

      {ctx.groups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add a group to start a competition. The existing Progress Bar becomes Group A.
        </p>
      )}
    </div>
  );
}

function GroupCard({
  title, subtitle, studentRows, stats, groups, currentGroupId,
  onRename, onDelete, onMoveStudent, group, onRestyle, status,
}: {
  title: string;
  subtitle: string;
  studentRows: Member[];
  stats: AdventureBarSummary | null;
  groups: AdventureGroup[];
  currentGroupId?: string;
  onRename?: () => void;
  onDelete?: () => void;
  onMoveStudent?: (studentId: string, groupId: string) => void;
  group?: AdventureGroup;
  onRestyle?: (style: { color?: string | null; scale?: number | null }) => void;
  status?: GroupStatus;
}) {
  const [expanded, setExpanded] = useState(false);
  const targets = groups.filter((g) => g.id !== currentGroupId);
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1">
          {status && (
            <span
              className={
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                (status === "winner"
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-600 dark:text-amber-300"
                  : status === "completed"
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-600 dark:text-emerald-300"
                    : status === "eliminated"
                      ? "border-border bg-muted/40 text-muted-foreground"
                      : "border-primary/40 bg-primary/10 text-primary")
              }
            >
              {GROUP_STATUS_LABEL[status]}
            </span>
          )}
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
        <Meta label="Students" value={String(studentRows.length)} />
        <Meta label="Achieved" value={stats ? `${stats.achieved} / ${stats.required}` : "—"} />
        <Meta label="Per Slot" value={stats ? `${stats.perSlot}` : "—"} />
      </div>

      {group && !group.qualified && (
        <p className="mt-2 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
          Watching the rest of the journey — this group missed a Learning Point target.
        </p>
      )}

      {onRestyle && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bar look</span>
          <input
            type="color"
            value={group?.style_color ?? "#8a5cff"}
            onChange={(e) => onRestyle({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent"
            aria-label="Bar colour"
          />
          <input
            type="range"
            min={8}
            max={40}
            step={1}
            value={Math.round((group?.style_scale ?? 0.18) * 100)}
            onChange={(e) => onRestyle({ scale: Number(e.target.value) / 100 })}
            className="flex-1"
            aria-label="Bar size"
          />
          <button
            type="button"
            onClick={() => onRestyle({ color: null, scale: null })}
            className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
          >
            Reset
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {expanded ? "Hide" : "Show"} students ({studentRows.length})
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1">
          {studentRows.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-2 py-1 text-xs">
              <span className="truncate">{m.display_name}</span>
              {targets.length > 0 && onMoveStudent && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const gid = e.target.value;
                    if (gid) { onMoveStudent(m.user_id, gid); e.target.value = ""; }
                  }}
                  className="h-6 rounded border border-input bg-background px-1 text-[11px]"
                  aria-label={`Move ${m.display_name} to another group`}
                >
                  <option value="">Move to…</option>
                  {targets.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
          {studentRows.length === 0 && <li className="text-[11px] text-muted-foreground">No students yet.</li>}
        </ul>
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
