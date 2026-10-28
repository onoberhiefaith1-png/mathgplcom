// Teacher — Group Setup, on the Adventure page (never on the gameplay dashboard).
//
// A group is a named team of students. Nothing is duplicated: every group
// competes on the same master Progress Bar, so all teams answer the same
// questions and a student's marks travel with them between teams.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  assignStudentToGroup,
  deleteGroup,
  renameGroup,
  getGroupCompletionMessage,
  setGroupCompletionMessage,
  DEFAULT_GROUP_COMPLETION_MESSAGE,
  MAX_GROUPS,
  type AdventureGroup,
} from "@/lib/adventures/groups";
import { addGroup, nextGroupName } from "@/lib/adventures/groupCompetition";
import { useAdventureGroups } from "@/hooks/useAdventureGroups";
import { getGameMode, setGameMode, type GameMode } from "@/lib/adventures/gameMode";

type Member = { user_id: string; display_name: string };

interface Props {
  classId: string;
  gameId: string;
  /** The master Progress Bar every group competes on. */
  masterBarId: string | null;
}

export function GroupSetupPanel({ classId, gameId, masterBarId }: Props) {
  const ctx = useAdventureGroups(classId, gameId);
  const [mode, setMode] = useState<GameMode>("individual");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(DEFAULT_GROUP_COMPLETION_MESSAGE);
  const [savingMessage, setSavingMessage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getGameMode(classId, gameId).then((m) => { if (!cancelled) setMode(m); });
    void getGroupCompletionMessage(classId, gameId).then((m) => { if (!cancelled) setMessage(m); });
    void supabase
      .rpc("get_class_member_names", { _class_id: classId })
      .then(({ data }) => {
        if (cancelled) return;
        setMembers(((data ?? []) as Member[]).slice());
      });
    return () => { cancelled = true; };
  }, [classId, gameId]);

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const switchMode = useCallback(
    async (next: GameMode) => {
      setMode(next);
      try { await setGameMode(classId, gameId, next); }
      catch (e) { toast({ title: "Could not change mode", description: (e as Error).message, variant: "destructive" }); }
    },
    [classId, gameId],
  );

  const doAdd = async () => {
    const suggested = nextGroupName(ctx.groups);
    const name = window.prompt("Name this group:", suggested);
    if (name === null) return;
    setBusy(true);
    try {
      const res = await addGroup({
        classId, gameId, groups: ctx.groups, memberIds, sourceBarId: masterBarId, name: name || suggested,
      });
      if (res.ok === false) {
        toast({
          title: res.reason === "max_groups" ? `Maximum ${MAX_GROUPS} groups` : "No Progress Bar found",
          description:
            res.reason === "max_groups"
              ? "Delete a group before adding another."
              : "Link this Adventure to a lesson question first.",
          variant: "destructive",
        });
        return;
      }
      await ctx.refresh();
      toast({
        title: `${res.group.name} created`,
        description: res.adopted
          ? "Every student joined this team. Add more teams and move students between them."
          : "Move students into this team.",
      });
    } catch (e) {
      toast({ title: "Could not add group", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doRename = async (g: AdventureGroup) => {
    const name = window.prompt("Rename group:", g.name);
    if (!name || name.trim() === g.name) return;
    try { await renameGroup(g.id, name.trim()); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not rename", description: (e as Error).message, variant: "destructive" }); }
  };

  const doDelete = async (g: AdventureGroup) => {
    if (!window.confirm(`Delete "${g.name}"? Its students become unassigned.`)) return;
    try { await deleteGroup(g.id); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" }); }
  };

  const move = async (studentId: string, groupId: string | null) => {
    try { await assignStudentToGroup(classId, gameId, studentId, groupId); await ctx.refresh(); }
    catch (e) { toast({ title: "Could not move", description: (e as Error).message, variant: "destructive" }); }
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

  const unassigned = members.filter((m) => !ctx.studentGroup.has(m.user_id));

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Game Mode
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["individual", "group"] as GameMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => void switchMode(m)}
              className={
                "rounded px-2.5 py-1 text-[11px] font-medium transition " +
                (mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
              }
            >
              {m === "individual" ? "Individual Mode" : "Group Competition"}
            </button>
          ))}
        </div>
      </div>

      {mode === "individual" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Every student plays on their own. Switch to Group Competition to divide the class into teams.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Divide the class into teams. All teams share the same questions and rules.
            </p>
            {ctx.groups.length < MAX_GROUPS && (
              <button
                type="button"
                onClick={doAdd}
                disabled={busy || !masterBarId}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add Group
              </button>
            )}
          </div>

          {!masterBarId && (
            <p className="text-xs text-destructive">
              Link this Lesson Note to a Progress Bar first — the teams compete on it.
            </p>
          )}

          {ctx.groups.map((g) => {
            const ids = Array.from(ctx.studentsByGroup.get(g.id) ?? []);
            const rows = ids.map((id) => memberById.get(id)).filter(Boolean) as Member[];
            return (
              <div key={g.id} className="rounded-lg border border-border/60 bg-card/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{g.name}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{rows.length} students</span>
                    <button type="button" onClick={() => doRename(g)} className="rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-accent">
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => doDelete(g)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border hover:bg-accent"
                      aria-label={`Delete ${g.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {rows.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between gap-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs">
                      <span className="truncate">{m.display_name}</span>
                      <select
                        value={g.id}
                        onChange={(e) => void move(m.user_id, e.target.value || null)}
                        className="h-6 rounded border border-input bg-background px-1 text-[11px]"
                        aria-label={`Team for ${m.display_name}`}
                      >
                        {ctx.groups.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        <option value="">Unassigned</option>
                      </select>
                    </li>
                  ))}
                  {rows.length === 0 && <li className="text-[11px] text-muted-foreground">No students yet.</li>}
                </ul>
              </div>
            );
          })}

          {unassigned.length > 0 && ctx.groups.length > 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unassigned</div>
              <ul className="mt-1.5 space-y-1">
                {unassigned.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs">
                    <span className="truncate">{m.display_name}</span>
                    <select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) void move(m.user_id, e.target.value); }}
                      className="h-6 rounded border border-input bg-background px-1 text-[11px]"
                      aria-label={`Assign ${m.display_name} to a team`}
                    >
                      <option value="">Assign to…</option>
                      {ctx.groups.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-card/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Group Completion Message
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Shown to a team that hasn&apos;t reached the target when a Learning Point ends.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={saveMessage}
                disabled={savingMessage}
                className="rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
              >
                Save message
              </button>
              <button
                type="button"
                onClick={() => setMessage(DEFAULT_GROUP_COMPLETION_MESSAGE)}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-accent"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
