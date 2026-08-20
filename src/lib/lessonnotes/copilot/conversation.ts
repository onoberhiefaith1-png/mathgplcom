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

export function useCoPilotConversation(bridgeRef: React.MutableRefObject<CoPilotBridge | null>) {
  const [messages, setMessages] = useState<CoPilotMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const [stage, setStage] = useState<CoPilotStage>("greeting");
  const [counts, setCounts] = useState<StructureCounts>({ ...DEFAULT_STRUCTURE });
  const [queue, setQueue] = useState<BuildItem[]>([]);
  const [analysis, setAnalysis] = useState<CoPilotAnalysis | null>(null);
  /** The narrated planning line, so the panel never shows one frozen phrase. */
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  /** Set whenever a call fails or times out: the panel offers "Try again". */
  const [retry, setRetry] = useState<{ label: string; run: () => void } | null>(null);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const queueRef = useRef<BuildItem[]>(queue);
  queueRef.current = queue;
  const analysisRef = useRef<CoPilotAnalysis | null>(analysis);
  analysisRef.current = analysis;
  const materialRef = useRef<CoPilotMaterial>(emptyMaterial());
  const pauseRef = useRef(false);
  const greetedRef = useRef(false);

  const say = useCallback((text: string, extra: Partial<CoPilotMessage> = {}) => {
    const id = uid();
    setMessages((prev) => [...prev, { id, role: "copilot", text, ...extra }]);
    return id;
  }, []);

  const patch = useCallback((id: string, next: Partial<CoPilotMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
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

  /** One call to the Copilot backend, bounded so the panel can never hang. */
  const ask = useCallback(async (payload: Record<string, unknown>) => {
    const snapshot = bridgeRef.current?.snapshot() ?? null;
    const { data, error } = await withTimeout(
      supabase.functions.invoke("notebook-ai", {
        body: { mode: "copilot", snapshot, ...payload },
      }),
      COPILOT_CALL_TIMEOUT_MS,
      "That took longer than expected and I stopped waiting — try again.",
    );
    if (error) throw error;
    return (data ?? {}) as any;
  }, [bridgeRef]);

  // ── Stage 1: greeting + the structure card ───────────────────────────
  useEffect(() => {
    if (greetedRef.current) {
      // A re-mount must never leave the panel spinning on a call it lost.
      setBusy(false);
      setStage((s) => (s === "greeting" ? "structure" : s));
      return;
    }
    greetedRef.current = true;
    (async () => {
      setBusy(true);
      try {
        const data = await ask({ stage: "greet" });
        const reply = String(data.reply ?? "").trim();
        say(reply || "Let's build this lesson. Start by setting the structure below.");
      } catch {
        say("Let's build this lesson. I've prepared the structure below — adjust the numbers before I begin.");
      } finally {
        // Always release the panel, even if this effect run was torn down.
        setBusy(false);
        setStage((s) => (s === "greeting" ? "structure" : s));
      }
    })();
  }, [ask, say]);


  // ── Stage 5: the build run ───────────────────────────────────────────
  const runBuild = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) { say("The lesson note is not ready yet — open it and I'll start."); setStage("idle"); return; }
    setStage("building");
    setBusy(true);

    const mark = (key: string, next: Partial<BuildItem>) => {
      setQueue((prev) => {
        const out = prev.map((q) => (q.key === key ? { ...q, ...next } : q));
        queueRef.current = out;
        return out;
      });
    };

    for (const item of queueRef.current) {
      if (item.state === "done") continue;
      if (pauseRef.current) {
        pauseRef.current = false;
        setBusy(false);
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
        if (item.withSolution) {
          await bridge.generateSolution(
            ref,
            "Write the full step-by-step classroom solution for this question, one micro-step per line.",
          );
        }
        mark(item.key, { state: "done" });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        mark(item.key, { state: "failed", detail });
        setBusy(false);
        setStage("idle");
        say(`I stopped at ${item.label}. ${detail} Everything built before it is untouched — tell me how you'd like to proceed.`);
        return;
      }
    }

    setBusy(false);
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
    } catch {
      say("The lesson is built. Read through it and tell me anything you want changed.");
    }
  }, [ask, bridgeRef, counts, say]);

  // ── Stage 4: plan the lesson (analysis → blueprint). Nothing is written
  // into the note here: the teacher reviews and approves the plan first.
  const planLesson = useCallback(async (material: CoPilotMaterial) => {
    materialRef.current = material;
    setRetry(null);
    setStage("analysing");
    setBusy(true);
    const stopNarration = narrate(PLANNING_STEPS);
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
      const detail = e instanceof Error ? e.message : String(e);
      say(`I couldn't finish planning the lesson: ${detail}`);
      setRetry({ label: "Plan the lesson again", run: () => void planLesson(materialRef.current) });
      setStage("blueprint");
    } finally {
      stopNarration();
      setBusy(false);
    }
  }, [ask, counts, narrate, say]);

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
    setRetry(null);
    setBusy(true);
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
      const detail = e instanceof Error ? e.message : String(e);
      say(`I couldn't revise ${item.label}: ${detail}`);
      setRetry({ label: `Revise ${item.label} again`, run: () => void reviseBlueprintItem(key, instruction) });
    } finally {
      setProgressLabel(null);
      setBusy(false);
    }
  }, [ask, counts, say]);

  // ── Stage 2 → 3 ─────────────────────────────────────────────────────
  const confirmStructure = useCallback(async () => {
    const q = buildQueue(counts);
    if (!q.length) { say("Give at least one section a number and I'll start building."); return; }
    setQueue(q);
    queueRef.current = q;
    setStage("material");
    setBusy(true);
    try {
      const data = await ask({ stage: "structureConfirmed", structure: counts });
      const reply = String(data.reply ?? "").trim();
      say(reply || "Structure noted. Additional information is optional — paste anything you want me to follow, or just say Proceed and I'll plan the lesson myself.");
    } catch {
      say("Structure noted. Additional information is optional — paste anything you want me to follow, or just say Proceed and I'll plan the lesson myself.");
    } finally {
      setBusy(false);
    }
  }, [ask, counts, say]);

  const provideMaterial = useCallback((m: CoPilotMaterial) => { void planLesson(m); }, [planLesson]);
  /** "Proceed without additional information" — never a blocked path. */
  const skipMaterial = useCallback(() => { void planLesson(emptyMaterial()); }, [planLesson]);
  const approveBlueprint = useCallback(() => { void runBuild(); }, [runBuild]);
  const resumeBuild = useCallback(() => { void runBuild(); }, [runBuild]);

  // ── Approved-proposal execution (supervision stage) ──────────────────
  const execute = useCallback(async (id: string, proposal: CoPilotProposal) => {
    const bridge = bridgeRef.current;
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
    setBusy(true);
    const live = [...steps];
    for (let i = 0; i < proposal.actions.length; i++) {
      live[i] = { ...live[i], state: "running" };
      patch(id, { run: [...live] });
      try {
        await runCoPilotAction(bridge, proposal.actions[i]);
        live[i] = { ...live[i], state: "done" };
      } catch (e) {
        live[i] = { ...live[i], state: "failed", detail: e instanceof Error ? e.message : String(e) };
        patch(id, { run: [...live] });
        setBusy(false);
        say(`I stopped at "${live[i].label}". ${live[i].detail ?? ""} Nothing after that step was changed.`);
        return;
      }
      patch(id, { run: [...live] });
    }
    setBusy(false);
    say("Done — that's applied to the note.");
  }, [bridgeRef, patch, say]);


  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const teacherMsg: CoPilotMessage = { id: uid(), role: "teacher", text: clean };
    setMessages((prev) => [...prev, teacherMsg]);

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

    setBusy(true);
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
        setBusy(false);
        await execute(msgId, proposal);
        return;
      }

    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      say(`I could not complete that: ${detail}`);
      setRetry({ label: "Try that again", run: () => void send(clean) });
    } finally {
      setBusy(false);
    }
  }, [ask, confirmStructure, counts, execute, messages, planLesson, reviseBlueprintItem, runBuild, say]);

  const approve = useCallback((m: CoPilotMessage) => {
    if (!m.proposal) return;
    void execute(m.id, m.proposal);
  }, [execute]);

  const reject = useCallback((m: CoPilotMessage) => {
    patch(m.id, { settled: "rejected" });
    say("Left as it is. Tell me what you'd prefer instead.");
  }, [patch, say]);

  return {
    messages, busy, send, approve, reject,
    stage, counts, setCounts, confirmStructure,
    provideMaterial, skipMaterial,
    queue, resumeBuild, analysis,
    progressLabel, retry,
    editBlueprintItem, reviseBlueprintItem, approveBlueprint,
  };
}
