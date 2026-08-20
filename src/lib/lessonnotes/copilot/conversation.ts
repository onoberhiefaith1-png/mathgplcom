// MathGPL Copilot — conversation + the fixed procedure state machine.
//
// The procedure is predetermined: greeting → structure → additional
// information → analysis → build → supervision. The Copilot behaves
// naturally inside it, and every piece of mathematics is produced by the
// lesson note's OWN generators through the editor bridge.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/withTimeout";

/** Generous: real generation can take a while, but never forever. */
const COPILOT_CALL_TIMEOUT_MS = 120_000;

import {
  isKnownAction, isDestructive, runCoPilotAction, validateAction,
  type CoPilotAction, type CoPilotBridge, type CoPilotMessage,
  type CoPilotProposal, type CoPilotRunStep,
} from "./actions";

import {
  DEFAULT_STRUCTURE, PLANNING_STEPS, buildQueue, emptyMaterial, isProceedIntent, itemInstruction,
  type BuildItem, type CoPilotAnalysis, type CoPilotMaterial,
  type CoPilotStage, type StructureCounts,
} from "./procedure";

import {
  appendMessage, loadMessages, loadOrCreateSession, patchSession, resumeSummary,
  updateMessage, type CoPilotSessionState,
} from "./session";

export type CoPilotLifecycle = "ready" | "thinking" | "generating" | "validating" | "stopped" | "failed";


const uid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const sanitizeProposal = (raw: any): CoPilotProposal | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const actions: CoPilotAction[] = Array.isArray(raw.actions)
    ? raw.actions
        .filter((a: any) => isKnownAction(a?.name))
        .map((a: any) => ({
          name: a.name,
          label: String(a.label ?? a.name),
          target: a.target ? String(a.target) : null,
          sectionKind: a.sectionKind ? String(a.sectionKind) : null,
          instruction: a.instruction ? String(a.instruction) : null,
          destructive: a.destructive === true,
        }))
    : [];
  const summary = String(raw.summary ?? "").trim();
  if (!summary && actions.length === 0) return undefined;
  return {
    summary,
    preserves: Array.isArray(raw.preserves) ? raw.preserves.map(String).slice(0, 6) : [],
    steps: Array.isArray(raw.steps) && raw.steps.length
      ? raw.steps.map(String).slice(0, 8)
      : actions.map((a) => a.label),
    actions,
  };
};

const sanitizeAnalysis = (raw: any): CoPilotAnalysis | null => {
  if (!raw || typeof raw !== "object") return null;
  const s = (v: any) => (typeof v === "string" ? v.trim() : "");
  const a: CoPilotAnalysis = {
    level: s(raw.level), style: s(raw.style), method: s(raw.method),
    progression: s(raw.progression), terminology: s(raw.terminology), brief: s(raw.brief),
  };
  return a.brief || a.style || a.level || a.method ? a : null;
};

export function useCoPilotConversation(
  bridgeRef: React.MutableRefObject<CoPilotBridge | null>,
  notebookId?: string,
) {
  const [messages, setMessages] = useState<CoPilotMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [lifecycle, setLifecycle] = useState<CoPilotLifecycle>("ready");

  const [stage, setStage] = useState<CoPilotStage>("greeting");
  const [counts, setCounts] = useState<StructureCounts>({ ...DEFAULT_STRUCTURE });
  const [queue, setQueue] = useState<BuildItem[]>([]);
  const [analysis, setAnalysis] = useState<CoPilotAnalysis | null>(null);
  /** The narrated planning line, so the panel never shows one frozen phrase. */
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  /** Set whenever a call fails or times out: the panel offers "Try again". */
  const [retry, setRetry] = useState<{ label: string; run: () => void } | null>(null);
  /** True until the stored conversation has been read back. */
  const [hydrating, setHydrating] = useState<boolean>(Boolean(notebookId));

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const queueRef = useRef<BuildItem[]>(queue);
  queueRef.current = queue;
  const analysisRef = useRef<CoPilotAnalysis | null>(analysis);
  analysisRef.current = analysis;
  const materialRef = useRef<CoPilotMaterial>(emptyMaterial());
  const pauseRef = useRef(false);
  const greetedRef = useRef(false);
  /** Mirrors `busy` so a second click can never start a duplicate request. */
  const busyRef = useRef(false);
  /** The in-flight Co-Pilot request, so Cancel is a real cancellation. */
  const abortRef = useRef<AbortController | null>(null);
  /** Set by Cancel: the reply of the abandoned request is discarded. */
  const cancelledRef = useRef(false);

  /** One place that moves the spinner, so it always matches reality. */
  const markBusy = useCallback((next: boolean) => {
    busyRef.current = next;
    setBusy(next);
  }, []);

  const setWorking = useCallback((next: Exclude<CoPilotLifecycle, "ready" | "stopped" | "failed">) => {
    setLifecycle(next);
    markBusy(true);
  }, [markBusy]);

  const finishWorking = useCallback((next: "ready" | "stopped" | "failed" = "ready") => {
    setLifecycle(next);
    markBusy(false);
  }, [markBusy]);

  /** An aborted request must never speak — the teacher already moved on. */
  const isAbort = (e: unknown) =>
    cancelledRef.current ||
    (e as { name?: string } | null)?.name === "AbortError" ||
    /abort/i.test(String((e as { message?: string } | null)?.message ?? ""));

  /** The persistent lesson conversation this note owns. */
  const sessionRef = useRef<CoPilotSessionState | null>(null);
  const cycleRef = useRef(1);
  /** local message id → stored row id, so a live edit updates the right row. */
  const rowIdRef = useRef<Map<string, string>>(new Map());

  /** Write one message into the note's conversation. */
  const remember = useCallback((
    localId: string,
    role: "teacher" | "copilot",
    text: string,
    payload?: Record<string, unknown>,
  ) => {
    const sid = sessionRef.current?.id;
    if (!sid) return;
    void appendMessage(sid, { role, text, cycle: cycleRef.current, payload })
      .then((rowId) => { if (rowId) rowIdRef.current.set(localId, rowId); })
      .catch(() => {});
  }, []);

  const say = useCallback((text: string, extra: Partial<CoPilotMessage> = {}) => {
    const id = uid();
    setMessages((prev) => [...prev, { id, role: "copilot", text, ...extra }]);
    remember(id, "copilot", text, Object.keys(extra).length ? (extra as Record<string, unknown>) : undefined);
    return id;
  }, [remember]);

  const patch = useCallback((id: string, next: Partial<CoPilotMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
    const rowId = rowIdRef.current.get(id);
    if (rowId) {
      setMessages((prev) => {
        const live = prev.find((m) => m.id === id);
        if (live) {
          const { id: _drop, role: _r, text, ...payload } = live as Record<string, unknown> & CoPilotMessage;
          void updateMessage(rowId, { text, payload: payload as Record<string, unknown> }).catch(() => {});
        }
        return prev;
      });
    }
  }, []);

  /** Persist the durable lesson state whenever it moves. */
  const saveState = useCallback((patchState: Parameters<typeof patchSession>[1]) => {
    const sid = sessionRef.current?.id;
    if (!sid) return;
    void patchSession(sid, patchState).catch(() => {});
  }, []);

  /** Rotate real planning steps while a long call is in flight. */
  const narrate = useCallback((steps: string[]) => {
    let i = 0;
    setProgressLabel(steps[0] ?? null);
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setProgressLabel(steps[i]);
    }, 4500);
    return () => { clearInterval(timer); setProgressLabel(null); };
  }, []);

  /**
   * One call to the Copilot backend. Bounded so the panel can never hang, and
   * genuinely cancellable so the teacher is never trapped behind a spinner.
   */
  const ask = useCallback(async (payload: Record<string, unknown>) => {
    const snapshot = bridgeRef.current?.snapshot() ?? null;
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("notebook-ai", {
          body: { mode: "copilot", snapshot, ...payload },
          signal: controller.signal,
        }),
        COPILOT_CALL_TIMEOUT_MS,
        "That took longer than expected and I stopped waiting — try again.",
      );
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (error) throw error;
      return (data ?? {}) as any;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [bridgeRef]);

  /** Cancel — a real stop, not a hidden request that keeps running. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    pauseRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setProgressLabel(null);
    setRetry(null);
    finishWorking("stopped");
    setStage((s) => (s === "greeting" ? "structure" : s === "analysing" ? "material" : s === "building" ? "idle" : s));
    say("Stopped there. Everything already in the note is untouched — tell me what you'd like next.");
  }, [finishWorking, say]);

  // ── Stage 1: resume the lesson conversation, or greet once ────────────
  // The same conversation lives for the whole life of the lesson note: it is
  // read back from the database, never restarted.
  useEffect(() => {
    if (greetedRef.current) {
      // A re-mount must never leave the panel spinning on a call it lost.
      markBusy(false);
      setStage((s) => (s === "greeting" ? "structure" : s));
      return;
    }
    greetedRef.current = true;
    (async () => {
      markBusy(true);
      let resumed = false;
      try {
        if (notebookId) {
          const session = await loadOrCreateSession(notebookId);
          sessionRef.current = session;
          if (session) {
            cycleRef.current = session.cycle;
            const stored = await loadMessages(session.id);
            if (stored.length) {
              setMessages(stored.map(({ cycle: _c, ...m }) => m));
              // Restore exactly where the lesson stopped.
              if (Object.keys(session.structure).length) setCounts(session.structure);
              if (session.queue.length) { setQueue(session.queue); queueRef.current = session.queue; }
              if (session.analysis) { setAnalysis(session.analysis); analysisRef.current = session.analysis; }
              const restored: CoPilotStage = session.stage === "building" ? "idle" : session.stage;
              setStage(restored === "greeting" ? "structure" : restored);
              // Transient, not stored: one line saying where we are.
              setMessages((prev) => [...prev, { id: uid(), role: "copilot", text: resumeSummary(session) }]);
              resumed = true;
            }
          }
        }
      } catch {
        // A persistence failure must never block the conversation.
      }
      if (resumed) { setHydrating(false); markBusy(false); return; }
      setHydrating(false);
      try {
        const data = await ask({ stage: "greet" });
        const reply = String(data.reply ?? "").trim();
        say(reply || "Let's build this lesson. Start by setting the structure below.");
      } catch {
        say("Let's build this lesson. I've prepared the structure below — adjust the numbers before I begin.");
      } finally {
        // Always release the panel, even if this effect run was torn down.
        markBusy(false);
        setStage((s) => (s === "greeting" ? "structure" : s));
      }
    })();
  }, [ask, notebookId, say]);

  // Keep the stored lesson state in step with the live one.
  useEffect(() => { if (!hydrating) saveState({ stage }); }, [hydrating, saveState, stage]);
  useEffect(() => { if (!hydrating) saveState({ queue }); }, [hydrating, queue, saveState]);
  useEffect(() => { if (!hydrating) saveState({ structure: counts }); }, [counts, hydrating, saveState]);
  useEffect(() => { if (!hydrating) saveState({ analysis }); }, [analysis, hydrating, saveState]);
  useEffect(() => {
    if (hydrating) return;
    const snap = bridgeRef.current?.snapshot();
    if (snap) saveState({ topic: snap.topic ?? "", subtopic: snap.activeSubtopic ?? "" });
  }, [bridgeRef, hydrating, saveState, stage]);



  // ── Stage 5: the build run ───────────────────────────────────────────
  const runBuild = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (busyRef.current) { say("I'm still working on the last step — give me a moment, or press Cancel to stop it."); return; }
    if (!bridge) { say("The lesson note is not ready yet — open it and I'll start."); setStage("idle"); return; }
    cancelledRef.current = false;
    pauseRef.current = false;
    setStage("building");
    setWorking("generating");

    const mark = (key: string, next: Partial<BuildItem>) => {
      setQueue((prev) => {
        const out = prev.map((q) => (q.key === key ? { ...q, ...next } : q));
        queueRef.current = out;
        return out;
      });
    };

    for (const item of queueRef.current) {
      if (item.state === "done") continue;
      if (pauseRef.current || cancelledRef.current) {
        pauseRef.current = false;
        if (cancelledRef.current) { markBusy(false); setStage("idle"); return; }
        markBusy(false);
        setStage("idle");
        say("I've paused the build here so nothing runs past your comment. Tell me what to change and I'll carry on from this point.");
        return;
      }
      mark(item.key, { state: "running" });
      if (item.note) say(item.note);
      try {
        const ref = bridge.insertSectionRef
          ? await bridge.insertSectionRef(item.kind)
          : (await bridge.insertSection(item.kind), bridge.snapshot()?.focusedRef ?? null);
        if (!ref) throw new Error("I could not place that section in the note.");
        await bridge.generateQuestion(ref, itemInstruction(item, analysisRef.current, queueRef.current), false);
        if (item.withSolution && !cancelledRef.current) {
          setLifecycle("validating");
          await bridge.generateSolution(
            ref,
            "Write the full step-by-step classroom solution for this question, one micro-step per line.",
          );
        }
        mark(item.key, { state: "done" });
      } catch (e) {
        if (isAbort(e)) { mark(item.key, { state: "pending" }); markBusy(false); setStage("idle"); return; }
        const detail = e instanceof Error ? e.message : String(e);
        mark(item.key, { state: "failed", detail });
        markBusy(false);
        setStage("idle");
        say(`I stopped at ${item.label}. ${detail} Everything built before it is untouched — tell me how you'd like to proceed.`);
        return;
      }
    }

    finishWorking();
    setStage("idle");
    try {
      const data = await ask({
        stage: "chat",
        message: "The build is finished. Close it off in one or two sentences: what you built, and what you'd check with the class.",
        history: [],
        structure: counts,
        analysis: analysisRef.current,
      });
      const reply = String(data.reply ?? "").trim();
      say(reply || "The lesson is built. Read through it and tell me anything you want changed.");
    } catch (e) {
      if (!isAbort(e)) say("The lesson is built. Read through it and tell me anything you want changed.");
    }
  }, [ask, bridgeRef, counts, finishWorking, say, setWorking]);

  // ── Stage 4: plan the lesson (analysis → blueprint). Nothing is written
  // into the note here: the teacher reviews and approves the plan first.
  const planLesson = useCallback(async (material: CoPilotMaterial) => {
    if (busyRef.current) { say("I'm still working — press Cancel if you want to start again."); return; }
    materialRef.current = material;
    cancelledRef.current = false;
    setRetry(null);
    setStage("analysing");
    setWorking("thinking");
    const stopNarration = narrate(PLANNING_STEPS);
    let outcome: "ready" | "stopped" | "failed" = "ready";
    try {
      const data = await ask({
        stage: "blueprint",
        structure: counts,
        material: { text: material.text, files: material.files },
        queue: queueRef.current.map((q) => ({ key: q.key, label: q.label, kind: q.kind })),
      });
      const reply = String(data.reply ?? "").trim();
      const parsed = sanitizeAnalysis(data.analysis);
      setAnalysis(parsed);
      analysisRef.current = parsed;

      const plans: Record<string, Partial<BuildItem>> = {};
      if (Array.isArray(data.blueprint)) {
        for (const b of data.blueprint) {
          if (!b || typeof b.key !== "string") continue;
          plans[b.key] = {
            plan: typeof b.plan === "string" ? b.plan.trim() : "",
            needsDiagram: b.needsDiagram === true,
            asset3d: typeof b.asset3d === "string" && b.asset3d.trim() ? b.asset3d.trim() : undefined,
            note: typeof b.note === "string" ? b.note.trim() : undefined,
          };
        }
      }
      setQueue((prev) => {
        const out = prev.map((q) => ({ ...q, ...(plans[q.key] ?? {}) }));
        queueRef.current = out;
        return out;
      });
      if (reply) say(reply);
      setStage("blueprint");
    } catch (e) {
      if (isAbort(e)) { outcome = "stopped"; setStage("material"); return; }
      outcome = "failed";
      const detail = e instanceof Error ? e.message : String(e);
      say(`I couldn't finish planning the lesson: ${detail}`);
      setRetry({ label: "Plan the lesson again", run: () => void planLesson(materialRef.current) });
      setStage("blueprint");
    } finally {
      stopNarration();
      finishWorking(outcome);
    }
  }, [ask, counts, finishWorking, narrate, say, setWorking]);

  /** The teacher edits one blueprint line directly. */
  const editBlueprintItem = useCallback((key: string, text: string) => {
    setQueue((prev) => {
      const out = prev.map((q) => (q.key === key ? { ...q, plan: text, edited: true } : q));
      queueRef.current = out;
      return out;
    });
  }, []);

  /** "make Example 2 harder" — revise ONLY that line, leave the rest alone. */
  const reviseBlueprintItem = useCallback(async (key: string, instruction: string) => {
    const item = queueRef.current.find((q) => q.key === key);
    if (!item) return;
    if (busyRef.current) { say("One thing at a time — I'm still working on the last request."); return; }
    cancelledRef.current = false;
    setRetry(null);
    markBusy(true);
    setProgressLabel(`Revising ${item.label}`);
    try {
      const data = await ask({
        stage: "reviseItem",
        structure: counts,
        analysis: analysisRef.current,
        item: { key: item.key, label: item.label, kind: item.kind, plan: item.plan ?? "" },
        queue: queueRef.current.map((q) => ({ key: q.key, label: q.label, kind: q.kind, plan: q.plan ?? "" })),
        message: instruction,
      });
      const plan = String(data.plan ?? "").trim();
      if (plan) {
        setQueue((prev) => {
          const out = prev.map((q) => (q.key === key
            ? { ...q, plan, edited: true, needsDiagram: data.needsDiagram === true ? true : q.needsDiagram }
            : q));
          queueRef.current = out;
          return out;
        });
      }
      const reply = String(data.reply ?? "").trim();
      say(reply || `${item.label} updated — the rest of the plan is untouched.`);
    } catch (e) {
      if (isAbort(e)) return;
      const detail = e instanceof Error ? e.message : String(e);
      say(`I couldn't revise ${item.label}: ${detail}`);
      setRetry({ label: `Revise ${item.label} again`, run: () => void reviseBlueprintItem(key, instruction) });
    } finally {
      setProgressLabel(null);
      markBusy(false);
    }
  }, [ask, counts, markBusy, say]);

  // ── Stage 2 → 3 ─────────────────────────────────────────────────────
  const confirmStructure = useCallback(async () => {
    if (busyRef.current) { say("I'm still working on the last step — one moment."); return; }
    cancelledRef.current = false;
    const q = buildQueue(counts);
    if (!q.length) { say("Give at least one section a number and I'll start building."); return; }
    setQueue(q);
    queueRef.current = q;
    setStage("material");
    markBusy(true);
    try {
      const data = await ask({ stage: "structureConfirmed", structure: counts });
      const reply = String(data.reply ?? "").trim();
      say(reply || "Structure noted. Additional information is optional — paste anything you want me to follow, or just say Proceed and I'll plan the lesson myself.");
    } catch {
      say("Structure noted. Additional information is optional — paste anything you want me to follow, or just say Proceed and I'll plan the lesson myself.");
    } finally {
      markBusy(false);
    }
  }, [ask, counts, markBusy, say]);

  const provideMaterial = useCallback((m: CoPilotMaterial) => { void planLesson(m); }, [planLesson]);
  /** "Proceed without additional information" — never a blocked path. */
  const skipMaterial = useCallback(() => { void planLesson(emptyMaterial()); }, [planLesson]);
  const approveBlueprint = useCallback(() => { void runBuild(); }, [runBuild]);
  const resumeBuild = useCallback(() => { void runBuild(); }, [runBuild]);

  // ── Approved-proposal execution (supervision stage) ──────────────────
  const execute = useCallback(async (id: string, proposal: CoPilotProposal) => {
    const bridge = bridgeRef.current;
    if (busyRef.current) { say("I'm still applying the last change — one moment."); return; }
    cancelledRef.current = false;
    const steps: CoPilotRunStep[] = proposal.actions.map((a) => ({
      label: a.label || a.name, state: "pending",
    }));
    patch(id, { settled: "approved", run: steps });
    if (!bridge) {
      patch(id, { run: steps.map((s) => ({ ...s, state: "failed", detail: "The lesson note is not ready." })) });
      return;
    }
    // Pre-flight: refuse the whole run when the note's own state makes a step
    // wrong (unresolved section, duplicate solution, map without a solution).
    const snap = bridge.snapshot();
    for (const a of proposal.actions) {
      const problem = a.name === "openGeometry2D" ? null : validateAction(snap, a);
      if (problem) {
        patch(id, { run: steps.map((s) => ({ ...s, state: "pending" })) });
        say(problem);
        return;
      }
    }
    markBusy(true);
    const live = [...steps];
    for (let i = 0; i < proposal.actions.length; i++) {
      live[i] = { ...live[i], state: "running" };
      patch(id, { run: [...live] });
      try {
        await runCoPilotAction(bridge, proposal.actions[i]);
        live[i] = { ...live[i], state: "done" };
      } catch (e) {
        if (isAbort(e)) { markBusy(false); return; }
        live[i] = { ...live[i], state: "failed", detail: e instanceof Error ? e.message : String(e) };
        patch(id, { run: [...live] });
        markBusy(false);
        say(`I stopped at "${live[i].label}". ${live[i].detail ?? ""} Nothing after that step was changed.`);
        return;
      }
      patch(id, { run: [...live] });
    }
    markBusy(false);
    say("Done — that's applied to the note.");
  }, [bridgeRef, markBusy, patch, say]);


  /** A new subtopic continues the SAME conversation as a new cycle. */
  const startNextCycle = useCallback(async (label: string) => {
    const clean = label.trim();
    if (!clean || busyRef.current) return;
    await bridgeRef.current?.insertSubtopic?.(clean);
    cycleRef.current += 1;
    setCounts({ ...DEFAULT_STRUCTURE });
    setAnalysis(null);
    analysisRef.current = null;
    setQueue([]);
    queueRef.current = [];
    setStage("structure");
    saveState({ cycle: cycleRef.current, queue: [], structure: { ...DEFAULT_STRUCTURE }, analysis: null, stage: "structure", subtopic: clean });
    say(`New subtopic: ${clean}. Everything already in the note stays. Set the numbers for this part and I'll plan it.`);
  }, [bridgeRef, saveState, say]);


  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (busyRef.current && stageRef.current !== "building") {
      say("I'm still working on the last request — press Cancel if you'd rather stop it.");
      return;
    }
    const teacherMsg: CoPilotMessage = { id: uid(), role: "teacher", text: clean };
    setMessages((prev) => [...prev, teacherMsg]);
    remember(teacherMsg.id, "teacher", clean);

    // Talking during a build is an interruption: finish the current item, then stop.
    if (stageRef.current === "building") {
      pauseRef.current = true;
      say("Understood — I'll finish the item I'm on and stop there so we can deal with that first.");
      return;
    }

    // "Proceed" always means proceed: never a request for more information.
    if (isProceedIntent(clean)) {
      if (stageRef.current === "material") {
        say("That's enough to work with — I'll plan the lesson from the topic, the structure you set and what I know about teaching it.");
        void planLesson(emptyMaterial());
        return;
      }
      if (stageRef.current === "blueprint" && queueRef.current.length) {
        say("Right — I'll turn the approved plan into the full lesson now. Every question goes in with its complete solution.");
        void runBuild();
        return;
      }
      if (stageRef.current === "structure") {
        void confirmStructure();
        return;
      }
    }

    // At the blueprint stage a named item is revised on its own.
    if (stageRef.current === "blueprint" && queueRef.current.length) {
      const hit = queueRef.current.find((q) =>
        clean.toLowerCase().includes(q.label.toLowerCase()));
      if (hit) {
        void reviseBlueprintItem(hit.key, clean);
        return;
      }
    }

    markBusy(true);
    try {
      const history = [...messages, teacherMsg].slice(-12).map((m) => ({ role: m.role, text: m.text }));
      const data = await ask({
        stage: "chat",
        message: clean,
        history,
        structure: counts,
        analysis: analysisRef.current,
        progress: queueRef.current.map((q) => ({ label: q.label, state: q.state })),
      });
      const reply = String(data.reply ?? "").trim();
      // One conversational flow: the AI decides whether to discuss or act.
      // Additive work runs straight away; anything that replaces existing
      // content waits for Approve.
      const proposal = sanitizeProposal(data.proposal);
      const msgId = uid();
      setMessages((prev) => [...prev, {
        id: msgId, role: "copilot",
        text: reply || (proposal ? proposal.summary : "I couldn't read that — could you put it another way?"),
        ...(proposal && (proposal.actions.length || proposal.steps.length) ? { proposal } : {}),
      }]);

      // Additive work runs straight away; replacements wait for approval.
      if (proposal && proposal.actions.length && !proposal.actions.some(isDestructive)) {
        markBusy(false);
        await execute(msgId, proposal);
        return;
      }

    } catch (e) {
      if (isAbort(e)) return;
      const detail = e instanceof Error ? e.message : String(e);
      say(`I could not complete that: ${detail}`);
      setRetry({ label: "Try that again", run: () => void send(clean) });
    } finally {
      markBusy(false);
    }
  }, [ask, bridgeRef, confirmStructure, counts, execute, markBusy, messages, planLesson, remember, reviseBlueprintItem, runBuild, say, startNextCycle]);

  const approve = useCallback((m: CoPilotMessage) => {
    if (!m.proposal) return;
    void execute(m.id, m.proposal);
  }, [execute]);

  const reject = useCallback((m: CoPilotMessage) => {
    patch(m.id, { settled: "rejected" });
    say("Left as it is. Tell me what you'd prefer instead.");
  }, [patch, say]);

  return {
    messages, busy, lifecycle, send, approve, reject, cancel,
    stage, counts, setCounts, confirmStructure,
    provideMaterial, skipMaterial,
    queue, resumeBuild, analysis,
    progressLabel, retry,
    editBlueprintItem, reviseBlueprintItem, approveBlueprint, startNextCycle,
  };
}
