import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  academiaForOrg,
  assignToAcademia,
  loadAcademiaTree,
  loadSessions,
  mySubjectIds,
  type AcademiaRow,
  type AcademiaSession,
} from "@/lib/academia/api";
import { listGames } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";

type Tree = Awaited<ReturnType<typeof loadAcademiaTree>>;

/**
 * Assign as Academia (Shared Workspace only): the school's Academia name is
 * fixed; the teacher picks Class → their assigned Subject → Topic → Subtopic →
 * Session, and optionally a Game. Nothing new is created here.
 */
const AcademiaAssignPicker = ({
  notebookId,
  subsectionId,
  title,
  orgId,
  onDone,
}: {
  notebookId: string;
  subsectionId: string | null;
  title: string;
  orgId: string | null;
  onDone: () => void;
}) => {
  const [academia, setAcademia] = useState<AcademiaRow | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<AcademiaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [gameId, setGameId] = useState("");

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    (async () => {
      try {
        const a = await academiaForOrg(orgId);
        const [t, ids, g] = await Promise.all([
          a ? loadAcademiaTree(a.id) : Promise.resolve(null),
          mySubjectIds(),
          listGames().catch(() => [] as Game[]),
        ]);
        if (!live) return;
        setAcademia(a);
        setTree(t);
        setMine(new Set(ids));
        setGames(g);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [orgId]);

  useEffect(() => {
    setSessionId("");
    if (!subtopicId) return setSessions([]);
    void loadSessions(subtopicId).then(setSessions);
  }, [subtopicId]);

  const subjects = useMemo(
    () => (tree?.subjects ?? []).filter((s) => s.class_id === classId && mine.has(s.id)),
    [tree, classId, mine],
  );
  const topics = (tree?.topics ?? []).filter((t) => t.subject_id === subjectId);
  const subtopics = (tree?.subtopics ?? []).filter((s) => s.topic_id === topicId);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Opening Academia…
      </div>
    );
  }
  if (!academia) {
    return <p className="py-6 text-center text-sm text-muted-foreground">This school hasn't opened its Academia yet.</p>;
  }

  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    items: { id: string; name: string }[],
    empty: string,
    disabled = false,
  ) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">{items.length ? `Choose ${label.toLowerCase()}` : empty}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>
    </div>
  );

  const submit = async () => {
    setBusy(true);
    try {
      await assignToAcademia({ sessionId, notebookId, subsectionId, title, gameId: gameId || null });
      toast({ title: "Added to Academia", description: "Practice is ready in the Session." });
      onDone();
    } catch (e) {
      toast({ title: "Could not assign", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Academia</Label>
        <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-medium">{academia.name}</div>
      </div>
      {select("Class", classId, (v) => { setClassId(v); setSubjectId(""); setTopicId(""); setSubtopicId(""); }, tree?.classes ?? [], "No classes yet")}
      {select("Subject", subjectId, (v) => { setSubjectId(v); setTopicId(""); setSubtopicId(""); }, subjects, "No subjects assigned to you", !classId)}
      {select("Topic", topicId, (v) => { setTopicId(v); setSubtopicId(""); }, topics, "No topics yet", !subjectId)}
      {select("Subtopic", subtopicId, setSubtopicId, subtopics, "No subtopics yet", !topicId)}
      {select("Session", sessionId, setSessionId, sessions.map((s) => ({ id: s.id, name: s.title })), "No sessions yet", !subtopicId)}
      {select("Game (optional)", gameId, setGameId, games.map((g) => ({ id: g.id, name: g.name || "Game" })), "No games yet")}
      <Button className="w-full" onClick={submit} disabled={!sessionId || busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Assign to Session
      </Button>
    </div>
  );
};

export default AcademiaAssignPicker;
