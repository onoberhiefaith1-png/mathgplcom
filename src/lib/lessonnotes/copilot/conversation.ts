// Co-Pilot conversation state.
//
// One turn = teacher message + the live note snapshot + the running transcript,
// sent to notebook-ai `mode: "copilot"`. The reply is either discussion or a
// proposal; a proposal only touches the note after the teacher approves it.

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isKnownAction, isDestructive, runCoPilotAction,
  type CoPilotAction, type CoPilotBridge, type CoPilotMessage,
  type CoPilotMode, type CoPilotProposal, type CoPilotRunStep,
} from "./actions";

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

export function useCoPilotConversation(bridgeRef: React.MutableRefObject<CoPilotBridge | null>) {
  const [mode, setMode] = useState<CoPilotMode>("plan");
  const [messages, setMessages] = useState<CoPilotMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const patch = useCallback((id: string, next: Partial<CoPilotMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...next } : m)));
  }, []);

  /** Execute an approved proposal, ticking each step as it completes. */
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
        setMessages((prev) => [...prev, {
          id: uid(), role: "copilot",
          text: `I stopped at "${live[i].label}". ${live[i].detail ?? ""} Nothing after that step was changed.`,
        }]);
        return;
      }
      patch(id, { run: [...live] });
    }
    setBusy(false);
    setMessages((prev) => [...prev, { id: uid(), role: "copilot", text: "Completed." }]);
  }, [bridgeRef, patch]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const teacherMsg: CoPilotMessage = { id: uid(), role: "teacher", text: clean };
    setMessages((prev) => [...prev, teacherMsg]);
    setBusy(true);
    try {
      const snapshot = bridgeRef.current?.snapshot() ?? null;
      const history = [...messages, teacherMsg]
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text }));
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: { mode: "copilot", copilotMode: modeRef.current, message: clean, history, snapshot },
      });
      if (error) throw error;
      const reply = String((data as any)?.reply ?? "").trim();
      const proposal = modeRef.current === "plan"
        ? sanitizeProposal((data as any)?.proposal)
        : sanitizeProposal((data as any)?.proposal);
      const msg: CoPilotMessage = {
        id: uid(), role: "copilot",
        text: reply || (proposal ? proposal.summary : "I could not read that — could you rephrase it?"),
        ...(proposal && proposal.actions.length ? { proposal } : {}),
      };
      setMessages((prev) => [...prev, msg]);

      // CREATE mode may act straight away, but only for additive work.
      if (
        modeRef.current === "create" && proposal && proposal.actions.length &&
        !proposal.actions.some(isDestructive)
      ) {
        setBusy(false);
        await execute(msg.id, proposal);
        return;
      }
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: uid(), role: "copilot",
        text: `I could not complete that: ${e instanceof Error ? e.message : String(e)}`,
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy, messages, bridgeRef, execute]);

  const approve = useCallback((m: CoPilotMessage) => {
    if (!m.proposal) return;
    void execute(m.id, m.proposal);
  }, [execute]);

  const reject = useCallback((m: CoPilotMessage) => {
    patch(m.id, { settled: "rejected" });
    setMessages((prev) => [...prev, {
      id: uid(), role: "copilot",
      text: "Left as it is. Tell me what you would prefer instead.",
    }]);
  }, [patch]);

  return { mode, setMode, messages, busy, send, approve, reject };
}
