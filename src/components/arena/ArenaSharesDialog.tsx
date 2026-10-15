// Teacher: Share Session (new group) and Reports (own groups for this Session).
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, MonitorPlay, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { createArenaShare } from "@/lib/arena/arena.functions";
import { fetchArenaBoard } from "@/lib/arena/arenaClient";
import { normaliseEntry, type EntryRule } from "@/lib/arena/ranking";
import { publicOrigin } from "@/lib/public/publicSite";

type Share = { id: string; code: string; display_code: string; title: string; status: string; created_at: string; entry_config: unknown };
type Stats = { joined: number; online: number; ranked: number };

const RULES: EntryRule[] = ["off", "optional", "required"];
const RULE_LABEL: Record<EntryRule, string> = { off: "Off", optional: "Optional", required: "Required" };

const studentUrl = (code: string) => `${publicOrigin()}/arena/${code}`;
const displayUrl = (code: string) => `${publicOrigin()}/arena/live/${code}`;
const copy = async (text: string, label: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${label} copied.`); } catch { toast.error("Could not copy."); }
};

const RulePicker = ({ label, value, onChange }: { label: string; value: EntryRule; onChange: (v: EntryRule) => void }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span>{label}</span>
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {RULES.map((r) => (
        <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}
          className={`rounded-md px-2 py-1 text-xs ${value === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{RULE_LABEL[r]}</button>
      ))}
    </div>
  </div>
);

const ArenaSharesDialog = ({ open, onOpenChange, sessionId, sessionTitle, mode }: {
  open: boolean; onOpenChange: (o: boolean) => void; sessionId: string; sessionTitle: string; mode: "share" | "reports";
}) => {
  const create = useServerFn(createArenaShare);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [creating, setCreating] = useState(mode === "share");
  const [title, setTitle] = useState("");
  const [nameRule, setNameRule] = useState<EntryRule>("optional");
  const [photoRule, setPhotoRule] = useState<EntryRule>("optional");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("arena_shares")
      .select("id, code, display_code, title, status, created_at, entry_config")
      .eq("source_id", sessionId).eq("owner_id", u.user?.id ?? "").order("created_at", { ascending: false });
    const rows = (data ?? []) as Share[];
    setShares(rows);
    const next: Record<string, Stats> = {};
    await Promise.all(rows.slice(0, 20).map(async (s) => {
      try { const b = await fetchArenaBoard(s.display_code); next[s.id] = { joined: b.joined, online: b.online, ranked: b.rankedParticipants }; } catch { /* skip */ }
    }));
    setStats(next);
  }, [sessionId]);

  useEffect(() => { if (open) { setCreating(mode === "share"); void load(); } }, [open, mode, load]);

  const submit = async () => {
    setBusy(true);
    try {
      const s = await create({ data: { sessionId, title: title.trim() || `${sessionTitle} — ${new Date().toLocaleDateString()}`, entry: { name: nameRule, photo: photoRule } } });
      await copy(studentUrl(s.code), "Student link");
      setTitle("");
      setCreating(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Could not create the group.");
    } finally { setBusy(false); }
  };

  const setStatus = async (s: Share, status: "open" | "closed") => {
    await supabase.from("arena_shares").update({ status }).eq("id", s.id);
    await load();
  };

  const saveEntry = async (s: Share, entry: { name: EntryRule; photo: EntryRule }) => {
    await supabase.from("arena_shares").update({ entry_config: entry }).eq("id", s.id);
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Timer Arena — {sessionTitle}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Each group has its own link and its own leaderboard. You only ever see students who joined through your links. Rankings use questions with the timer switched on.</p>

        {creating ? (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <label className="block text-xs text-muted-foreground">Group name
              <Input className="mt-1" placeholder="e.g. Monday Class A" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <RulePicker label="Ask for student name" value={nameRule} onChange={setNameRule} />
            <RulePicker label="Ask for a picture" value={photoRule} onChange={setPhotoRule} />
            <p className="text-[11px] text-muted-foreground">Students choose from built-in avatars, so nobody has to share a photo. When a name is not required, students can join with an anonymous ID such as Learner-4827.</p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create link"}</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New share link</Button>
        )}

        <h3 className="mt-2 text-sm font-semibold">Your groups</h3>
        {!shares ? <Loader2 className="h-4 w-4 animate-spin" /> : shares.length === 0 ? (
          <p className="text-xs text-muted-foreground">No groups yet. Create a share link to start.</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((s) => {
              const st = stats[s.id];
              const entry = normaliseEntry(s.entry_config);
              return (
                <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()} · {st ? `${st.joined} joined · ${st.online} online · ${st.ranked} with a correct finish` : "…"}
                        {s.status === "closed" && " · Closed"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => window.open(displayUrl(s.display_code), "_blank", "noopener")}><MonitorPlay className="mr-1.5 h-3.5 w-3.5" /> Open Live Report</Button>
                    <Button size="sm" variant="outline" onClick={() => copy(studentUrl(s.code), "Student link")}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link</Button>
                    <Button size="sm" variant="outline" onClick={() => copy(displayUrl(s.display_code), "Display link")}>Copy display link</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(s, s.status === "open" ? "closed" : "open")}>{s.status === "open" ? "Close group" : "Reopen"}</Button>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Entry settings</summary>
                    <div className="mt-2 space-y-2">
                      <RulePicker label="Student name" value={entry.name} onChange={(v) => saveEntry(s, { ...entry, name: v })} />
                      <RulePicker label="Picture" value={entry.photo} onChange={(v) => saveEntry(s, { ...entry, photo: v })} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ArenaSharesDialog;
