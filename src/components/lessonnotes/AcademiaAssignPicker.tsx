import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InstantPickList } from "@/components/common/InstantPickList";
import { toast } from "@/hooks/use-toast";
import {
  academiaForOrg,
  assignToAcademia,
  loadAcademiaTree,
  loadSessions,
  mySubjectIds,
  sessionAdventures,
  type AcademiaRow,
  type AcademiaSession,
} from "@/lib/academia/api";
import { listGames } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { getGame } from "@/lib/games/games";
import { collectLinkableBars } from "@/lib/adventures/barLinks";
import AdventurePointSlots, { type PointSlot } from "@/components/academia/AdventurePointSlots";
import { assignToLearningPoint } from "@/lib/academia/adventureSlots";
import TierPicker from "@/components/academia/TierPicker";
import { DEFAULT_TIER, TIER_LABEL, type AcademiaTier } from "@/lib/academia/tiers";

type Tree = Awaited<ReturnType<typeof loadAcademiaTree>>;

/**
 * Assign as Academia (Shared Workspace only): the school's Academia name is
 * fixed; the teacher picks Class → their assigned Subject → Topic → Subtopic →
 * Session, the tier batch (Beginner / Intermediate / Expert), and optionally a
 * Game. Nothing new is created here.
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
  const [tier, setTier] = useState<AcademiaTier>(DEFAULT_TIER);
  const [target, setTarget] = useState<"card" | "adventure">("card");
  const [adventures, setAdventures] = useState<{ id: string; gameId: string; title: string }[]>([]);
  const [adventureId, setAdventureId] = useState("");
  const [bars, setBars] = useState<PointSlot[]>([]);
  const [barId, setBarId] = useState("");
  const [slotsEpoch, setSlotsEpoch] = useState(0);

  useEffect(() => {
    setAdventureId("");
    if (!sessionId) return setAdventures([]);
    void sessionAdventures(sessionId).then(setAdventures).catch(() => setAdventures([]));
  }, [sessionId]);

  useEffect(() => {
    setBarId("");
    const adv = adventures.find((a) => a.id === adventureId);
    if (!adv) return setBars([]);
    void getGame(adv.gameId)
      .then((g) => {
        const groups = collectLinkableBars(g.canvas as never);
        // One slot per learning point: its identity is the scene, never the bar name.
        setBars(groups.filter((grp) => grp.bars.length > 0).map((grp) => ({
          sceneId: grp.sceneId,
          barId: grp.bars[0].id,
          label: `${grp.label} · ${(grp.bars[0] as { name?: string; label?: string }).label || (grp.bars[0] as { name?: string }).name || "Progress bar 1"}`,
        })));
      })
      .catch(() => setBars([]));
  }, [adventureId, adventures]);

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


  const submit = async () => {
    setBusy(true);
    try {
      if (target === "adventure") {
        const slot = bars.find((b) => b.sceneId === barId);
        if (!slot) throw new Error("Open a learning point first.");
        await assignToLearningPoint({ activityId: adventureId, sceneId: slot.sceneId, barId: slot.barId, notebookId, subsectionId, title });
        toast({ title: "Added to the Adventure", description: `The question is on ${slot.label}.` });
        setSlotsEpoch((n) => n + 1);
        return;
      }
      await assignToAcademia({ sessionId, notebookId, subsectionId, title, gameId: gameId || null, tier });
      toast({ title: "Added to Academia", description: `Practice is ready in the Session's ${TIER_LABEL[tier]} batch.` });
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
      <InstantPickList label="Class" value={classId} items={tree?.classes ?? []} empty="No classes yet"
        onChange={(v) => { setClassId(v); setSubjectId(""); setTopicId(""); setSubtopicId(""); setSessionId(""); }} />
      <InstantPickList label="Subject" value={subjectId} items={subjects} empty={classId ? "No subjects assigned to you" : "Choose a class first"} disabled={!classId}
        onChange={(v) => { setSubjectId(v); setTopicId(""); setSubtopicId(""); setSessionId(""); }} />
      <InstantPickList label="Topic" value={topicId} items={topics} empty={subjectId ? "No topics yet" : "Choose a subject first"} disabled={!subjectId}
        onChange={(v) => { setTopicId(v); setSubtopicId(""); setSessionId(""); }} />
      <InstantPickList label="Subtopic" value={subtopicId} items={subtopics} empty={topicId ? "No subtopics yet" : "Choose a topic first"} disabled={!topicId}
        onChange={(v) => { setSubtopicId(v); setSessionId(""); }} />
      <InstantPickList label="Session" value={sessionId} items={sessions.map((s) => ({ id: s.id, name: s.title }))} empty={subtopicId ? "No sessions yet" : "Choose a subtopic first"} disabled={!subtopicId}
        onChange={setSessionId} />
      <div className="space-y-1">
        <Label>Send to</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant={target === "card" ? "default" : "outline"} onClick={() => setTarget("card")}>Question card</Button>
          <Button type="button" size="sm" variant={target === "adventure" ? "default" : "outline"} onClick={() => setTarget("adventure")}>Adventure</Button>
        </div>
      </div>
      {target === "card" ? (
        <>
          <TierPicker value={tier} onChange={setTier} />
          <InstantPickList label="Game (optional)" value={gameId} items={games.map((g) => ({ id: g.id, name: g.name || "Game" }))} empty="No games yet" onChange={setGameId} />
        </>
      ) : (
        <>
          <InstantPickList label="Adventure" value={adventureId} items={adventures.map((a) => ({ id: a.id, name: a.title }))} empty={sessionId ? "Add an Adventure to this Session first" : "Choose a session first"} disabled={!sessionId} onChange={setAdventureId} />
          {adventureId && (
            <AdventurePointSlots activityId={adventureId} slots={bars} openSceneId={barId} onOpen={setBarId} epoch={slotsEpoch} />
          )}
        </>
      )}
      <Button className="w-full" onClick={submit} disabled={!sessionId || busy || (target === "adventure" && (!adventureId || !barId))}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {target === "adventure" ? "Assign to Adventure" : "Assign to Session"}
      </Button>
    </div>
  );
};

export default AcademiaAssignPicker;
