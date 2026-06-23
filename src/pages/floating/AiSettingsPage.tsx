// Floating Number Intelligence Center — AI-first workspace.
// Default: AI chat (70%) + sidebar (30%). When a law/draft/document is
// selected, layout shifts to AI (30%) + detail (50%) + sidebar (20%).
// The AI conversation is never unmounted, so memory persists across
// selection changes. Same edge function & shared knowledge as the
// Floating Number Generation page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Upload, Trash2, BookOpen, FileText, FlaskConical,
  RefreshCw, Send, Sparkles, Check, X, Edit3, Plus, Search, ScanLine, Cpu, Activity,
  Mic, MicOff, Paperclip, Image as ImageIcon, Phone, ChevronLeft, ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { renderMathInline } from "@/lib/notebook/mathRender";

/* ──────────────── types ──────────────── */


interface Law {
  id: string;
  name: string;
  rule: string;
  reason?: string | null;
  conditions?: any;
  exceptions?: any;
  lesson_topics?: string[] | null;
  tags?: string[] | null;
  version?: number;
  created_at?: string;
  approval_history?: any[];
  usage_count?: number;
  source?: string | null;
  status?: string | null;
  source_kind?: string | null;
}

interface KnowledgeDoc {
  id: string;
  kind: string;
  filename: string;
  storage_path: string | null;
  parsed_text?: string | null;
  created_at: string;
}

type Attachment = {
  id: string;
  filename: string;
  mime: string;
  data: string; // base64
  isImage: boolean;
  previewUrl?: string;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: { filename: string; isImage: boolean; previewUrl?: string }[];
  actions?: ChatAction[];
  mode?: ChatMode;
}

type ChatMode = "conversation" | "training" | "extraction";
type ChatAction =
  | { kind: "save_knowledge"; title: string }
  | { kind: "create_draft_law"; name: string }
  | { kind: "approve_official_law"; name: string }
  | { kind: "generate_document"; title: string }
  | { kind: "discard" };

/* ──────────────── style tokens ──────────────── */

const C = {
  pageBg: "#F5F1E8",
  panelBg: "#FFFFFF",
  text: "#0F172A",
  textSubtle: "#334155",
  textMuted: "#64748B",
  border: "#E5E7EB",
  borderStrong: "#CBD5E1",
  hover: "#F3F4F6",
  accent: "#1F2937",
  accentText: "#FFFFFF",
  approve: "#047857",
  reject: "#B91C1C",
  draft: "#B45309",
  bubbleUser: "#1F2937",
  bubbleUserText: "#FFFFFF",
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/* ──────────────── math-aware renderer ──────────────── */

function MathText({ text }: { text: string }) {
  // Render each line via renderMathInline so \frac, ^{}, _{}, √, Σ, ∫ etc.
  // appear as proper stacked math — same engine as Lesson Notes.
  const lines = text.split("\n");
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {lines.map((ln, i) => (
        <div key={i}>{ln ? renderMathInline(ln, `m${i}`) : "\u00A0"}</div>
      ))}
    </div>
  );
}

/* ──────────────── ACTIONS block parser ──────────────── */
// Pulls a trailing ```actions ... ``` fenced block out of an assistant reply
// and returns the clean text + parsed actions.
function parseActions(raw: string): { text: string; actions: ChatAction[] } {
  const re = /```actions\s*([\s\S]*?)```/i;
  const m = raw.match(re);
  if (!m) return { text: raw, actions: [] };
  const block = m[1];
  const actions: ChatAction[] = [];
  for (const line of block.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sk = l.match(/^save_knowledge\s*:\s*"?([^"]+?)"?$/i);
    if (sk) { actions.push({ kind: "save_knowledge", title: sk[1].trim() }); continue; }
    const cd = l.match(/^create_draft_law\s*:\s*"?([^"]+?)"?$/i);
    if (cd) { actions.push({ kind: "create_draft_law", name: cd[1].trim() }); continue; }
    const ap = l.match(/^approve_official_law\s*:\s*"?([^"]+?)"?$/i);
    if (ap) { actions.push({ kind: "approve_official_law", name: ap[1].trim() }); continue; }
    const gd = l.match(/^generate_document\s*:\s*"?([^"]+?)"?$/i);
    if (gd) { actions.push({ kind: "generate_document", title: gd[1].trim() }); continue; }
    if (/^discard\b/i.test(l)) actions.push({ kind: "discard" });
  }
  return { text: raw.replace(re, "").trim(), actions };
}

/* ──────────────── Multi-select action picker ──────────────── */
function ActionPicker({
  actions, busy, onRun,
}: { actions: ChatAction[]; busy: boolean; onRun: (sel: ChatAction[]) => void }) {
  const runnable = actions.filter((a) => a.kind !== "discard");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const labelFor = (a: ChatAction) => {
    if (a.kind === "approve_official_law") return `✅ Approve as Official Law: ${a.name}`;
    if (a.kind === "create_draft_law") return `📜 Create Draft Law: ${a.name}`;
    if (a.kind === "generate_document") return `📄 Generate Document: ${a.title}`;
    if (a.kind === "save_knowledge") return `💾 Save to Knowledge Base: ${a.title}`;
    return "Discard";
  };
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
      <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.textMuted }}>
        Select one or more actions:
      </div>
      <div className="flex flex-col gap-1.5 mb-2">
        {runnable.map((a, i) => (
          <label key={i} className="flex items-start gap-2 text-[13px] cursor-pointer select-none"
            style={{ color: C.text }}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={picked.has(i)}
              onChange={() => toggle(i)}
              disabled={busy}
            />
            <span>{labelFor(a)}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onRun(Array.from(picked).map((i) => runnable[i]))}
          disabled={busy || picked.size === 0}
          className="text-[12px] px-3 py-1.5 rounded-md disabled:opacity-40"
          style={{ background: C.accent, color: C.accentText }}
        >
          {busy ? "Running…" : `Execute Selected (${picked.size})`}
        </button>
        <button
          onClick={() => onRun([{ kind: "discard" }])}
          disabled={busy}
          className="text-[12px] px-3 py-1.5 rounded-md border hover:bg-black/5"
          style={{ borderColor: C.border, color: C.textMuted }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}


/* ──────────────── page ──────────────── */

const AiSettingsPage = () => {
  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();

  const [official, setOfficial] = useState<Law[]>([]);
  const [drafts, setDrafts] = useState<Law[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState("");

  const [openOfficial, setOpenOfficial] = useState(true);
  const [openDrafts, setOpenDrafts] = useState(true);
  const [openDocs, setOpenDocs] = useState(true);
  const [openEnginePrinciples, setOpenEnginePrinciples] = useState(false);
  const [openEngineLogs, setOpenEngineLogs] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [selectedLaw, setSelectedLaw] = useState<Law | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Law | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);


  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<ChatHandle | null>(null);

  /* ───── load knowledge ───── */

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("floating_law_library").select("*").order("created_at", { ascending: false }),
      supabase.from("floating_law_drafts").select("*").eq("status", "proposed").order("created_at", { ascending: false }),
      supabase.from("floating_knowledge_documents").select("*").order("created_at", { ascending: false }),
    ]);
    setOfficial((a.data as Law[]) ?? []);
    setDrafts((b.data as Law[]) ?? []);
    setDocs((c.data as KnowledgeDoc[]) ?? []);
    setLoading(false);
    setLastSyncedAt(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await load();
      try {
        const ch = supabase.channel("floating_knowledge_sync");
        await ch.subscribe();
        await ch.send({ type: "broadcast", event: "sync", payload: { at: Date.now() } });
        await supabase.removeChannel(ch);
      } catch { /* non-fatal */ }
      toast({ title: "AI knowledge synced" });
    } finally { setSyncing(false); }
  }, [load]);

  /* ───── draft actions ───── */

  const approveDraft = async (d: Law) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) { toast({ title: "Not signed in", variant: "destructive" }); return; }
    const { data: nextRow } = await supabase
      .from("floating_law_library")
      .select("law_number")
      .eq("owner_id", session.user.id)
      .order("law_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = ((nextRow as any)?.law_number ?? 0) + 1;
    const { error } = await supabase.from("floating_law_library").insert({
      owner_id: session.user.id,
      law_number: nextNumber,
      name: d.name, rule: d.rule, reason: d.reason ?? null,
      conditions: d.conditions ?? [], exceptions: d.exceptions ?? [],
      lesson_topics: d.lesson_topics ?? [], tags: d.tags ?? [],
      approval_history: [{ at: new Date().toISOString(), action: "approved", from_draft: d.id }],
    } as any);
    if (error) { toast({ title: "Approve failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("floating_law_drafts").update({ status: "approved" } as any).eq("id", d.id);
    toast({ title: `Law ${nextNumber} approved`, description: d.name });
    setSelectedDraft(null);
    load();
  };

  const rejectDraft = async (d: Law) => {
    await supabase.from("floating_law_drafts").update({ status: "rejected" } as any).eq("id", d.id);
    toast({ title: "Draft rejected" });
    setSelectedDraft(null);
    load();
  };

  /* ───── document actions ───── */

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not signed in");
      const path = `${session.user.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("floating-knowledge").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("floating_knowledge_documents").insert({
        owner_id: session.user.id, kind: file.type || "unknown", filename: file.name, storage_path: path,
      } as any);
      if (error) throw error;
      toast({ title: "Uploaded", description: file.name });
      load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setUploading(false); }
  };

  const deleteDoc = async (d: KnowledgeDoc) => {
    if (d.storage_path) await supabase.storage.from("floating-knowledge").remove([d.storage_path]);
    await supabase.from("floating_knowledge_documents").delete().eq("id", d.id);
    if (selectedDoc?.id === d.id) setSelectedDoc(null);
    load();
  };

  /* ───── law document generation ───── */
  const generateLawDocument = useCallback(async (l: Law) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) { toast({ title: "Not signed in", variant: "destructive" }); return; }
    toast({ title: "Generating law document…" });
    try {
      const { data, error } = await supabase.functions.invoke("floating-assistant", {
        body: {
          mode: "document",
          workspace: "knowledge",
          history: [],
          attachments: [],
          message:
            `Generate a full law document for "${l.name}".\n\n` +
            `Law statement: ${l.rule}\n` +
            (l.reason ? `Reasoning: ${l.reason}\n` : "") +
            (Array.isArray(l.lesson_topics) && l.lesson_topics.length ? `Topics: ${l.lesson_topics.join(", ")}\n` : "") +
            `\nProduce the sections: Title, Law Statement, Explanation, Examples, Floating Number Applications, Common Mistakes, Related Laws.`,
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? "";
      const { error: insErr } = await supabase.from("floating_knowledge_documents").insert({
        owner_id: session.user.id,
        kind: "law_document",
        filename: `${l.name}.md`,
        parsed_text: reply,
        metadata: { source: "generated", linked_law_id: l.id, law_name: l.name },
      } as any);
      if (insErr) throw insErr;
      toast({ title: "Law document created", description: l.name });
      load();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message ?? String(e), variant: "destructive" });
    }
  }, [load]);



  const q = filter.toLowerCase().trim();
  const filteredOfficial = useMemo(
    () => !q ? official : official.filter((l) =>
      l.name.toLowerCase().includes(q) || (l.rule ?? "").toLowerCase().includes(q) ||
      (l.tags ?? []).some((t) => (t ?? "").toLowerCase().includes(q))),
    [official, q],
  );
  const filteredDrafts = useMemo(
    () => !q ? drafts : drafts.filter((l) =>
      l.name.toLowerCase().includes(q) || (l.rule ?? "").toLowerCase().includes(q)),
    [drafts, q],
  );
  const filteredDocs = useMemo(
    () => !q ? docs : docs.filter((d) => d.filename.toLowerCase().includes(q)),
    [docs, q],
  );

  const hasSelection = !!(selectedLaw || selectedDraft || selectedDoc);
  const clearSelection = () => { setSelectedLaw(null); setSelectedDraft(null); setSelectedDoc(null); };

  /* ──────────────── render ──────────────── */

  return (
    <div className="h-screen flex flex-col" style={{ background: C.pageBg, color: C.text }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ background: C.panelBg, borderColor: C.border }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}`)}
            className="inline-flex items-center gap-1.5 text-sm px-2 py-1 rounded-md hover:bg-black/5"
            style={{ color: C.textSubtle }}
          >
            <ArrowLeft className="h-4 w-4" /> Back to workspace
          </button>
          <div className="h-5 w-px" style={{ background: C.border }} />
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: C.accent }} />
            <div>
              <div className="text-sm font-semibold leading-tight">Floating Number Intelligence Center</div>
              <div className="text-[11px] leading-tight" style={{ color: C.textMuted }}>
                AI workspace · shared memory with the Generation page
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <div className="text-[11px]" style={{ color: C.textMuted }}>
              Synced {lastSyncedAt.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync
          </button>
        </div>
      </div>


      {/* Body: AI on the left, detail in the middle when selected, sidebar on the right.
          The AI conversation is never unmounted. */}

      <div className="flex flex-1 min-h-0">
        {/* Left: AI chat — the primary workspace. */}
        <aside
          className="flex flex-col min-w-0 border-r"
          style={{
            flex: hasSelection ? "0 0 30%" : "1 1 100%",
            minWidth: 320,
            background: C.panelBg,
            borderColor: C.border,
          }}
        >
          <KnowledgeChat
            handleRef={(r) => { chatRef.current = r; }}
            subsectionId={subsectionId}
            onAfterAction={load}
          />
        </aside>

        {/* Middle: detail panel (when selected). */}
        {hasSelection && (
          <main
            className="min-w-0 overflow-y-auto border-r"
            style={{ flex: "0 0 50%", borderColor: C.border, background: C.pageBg }}
          >
            <div className="p-4 pb-0 flex items-center justify-between">
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-black/5"
                style={{ color: C.textSubtle }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Close
              </button>
            </div>
            <DetailPanel
              law={selectedLaw}
              draft={selectedDraft}
              doc={selectedDoc}
              onApproveDraft={approveDraft}
              onRejectDraft={rejectDraft}
              onAskAboutLaw={(p) => chatRef.current?.askExternal(p)}
              onGenerateLawDocument={generateLawDocument}
            />
          </main>
        )}

        {/* Right sidebar — collapsible resource panel. */}
        <aside
          className="shrink-0 flex flex-col border-l overflow-hidden transition-[width,min-width,max-width] duration-300 ease-in-out"
          style={{
            width: sidebarCollapsed ? 44 : (hasSelection ? 260 : "30%"),
            minWidth: sidebarCollapsed ? 44 : 260,
            maxWidth: sidebarCollapsed ? 44 : (hasSelection ? 280 : 420),
            background: C.panelBg,
            borderColor: C.border,
          }}
        >
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center pt-2 gap-2">
              <button
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                className="p-1.5 rounded hover:bg-black/5"
                style={{ color: C.textSubtle }}
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
              <div className="w-px flex-1" />
            </div>
          ) : (
            <>
              {/* Header with collapse button + Search */}
              <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: C.border }}>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  className="p-1 rounded hover:bg-black/5 shrink-0"
                  style={{ color: C.textSubtle }}
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border flex-1 min-w-0"
                  style={{ borderColor: C.border, background: C.hover }}>
                  <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.textMuted }} />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search laws, drafts, documents…"
                    className="bg-transparent outline-none text-xs flex-1 min-w-0"
                    style={{ color: C.text }}
                  />
                </div>
              </div>

              {/* Stacked sections */}
              <div className="flex-1 overflow-y-auto py-2">
                {loading ? (
                  <div className="py-10 text-center text-xs" style={{ color: C.textMuted }}>
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </div>
                ) : (
                  <>
                    <SidebarSection
                      icon={BookOpen}
                      label="Official Laws"
                      count={filteredOfficial.length}
                      open={openOfficial}
                      onToggle={() => setOpenOfficial((v) => !v)}
                    >
                      {filteredOfficial.length === 0 ? (
                        <EmptyHint text="No approved laws yet. Ask the AI to propose one." />
                      ) : (
                        filteredOfficial.map((l) => (
                          <ListRow
                            key={l.id}
                            active={selectedLaw?.id === l.id}
                            onClick={() => { setSelectedLaw(l); setSelectedDraft(null); setSelectedDoc(null); }}
                          >
                            <div className="font-medium text-[13px] truncate">{l.name}</div>
                            <div className="text-[11px] truncate" style={{ color: C.textMuted }}>{l.rule}</div>
                          </ListRow>
                        ))
                      )}
                    </SidebarSection>

                    <SidebarSection
                      icon={FlaskConical}
                      label="Draft Laws"
                      count={filteredDrafts.length}
                      open={openDrafts}
                      onToggle={() => setOpenDrafts((v) => !v)}
                    >
                      {filteredDrafts.length === 0 ? (
                        <EmptyHint text="No pending drafts." />
                      ) : (
                        filteredDrafts.map((d) => (
                          <ListRow
                            key={d.id}
                            active={selectedDraft?.id === d.id}
                            onClick={() => { setSelectedDraft(d); setSelectedLaw(null); setSelectedDoc(null); }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: "#FEF3C7", color: C.draft }}>DRAFT</span>
                              <div className="font-medium text-[13px] truncate flex-1">{d.name}</div>
                            </div>
                            <div className="text-[11px] truncate mt-0.5" style={{ color: C.textMuted }}>{d.rule}</div>
                          </ListRow>
                        ))
                      )}
                    </SidebarSection>

                    <SidebarSection
                      icon={FileText}
                      label="Documents"
                      count={filteredDocs.length}
                      open={openDocs}
                      onToggle={() => setOpenDocs((v) => !v)}
                      action={
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadFile(f);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            disabled={uploading}
                            title="Upload document"
                            className="p-1 rounded hover:bg-black/5"
                            style={{ color: C.textSubtle }}
                          >
                            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          </button>
                        </>
                      }
                    >
                      {filteredDocs.length === 0 ? (
                        <EmptyHint text="No documents yet. Upload PDFs, DOCX, or images." />
                      ) : (
                        filteredDocs.map((d) => (
                          <ListRow
                            key={d.id}
                            active={selectedDoc?.id === d.id}
                            onClick={() => { setSelectedDoc(d); setSelectedLaw(null); setSelectedDraft(null); }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[13px] truncate">{d.filename}</div>
                                <div className="text-[11px] truncate" style={{ color: C.textMuted }}>
                                  {d.kind} · {new Date(d.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteDoc(d); }}
                                className="p-1 rounded hover:bg-black/5 shrink-0"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" style={{ color: C.reject }} />
                              </button>
                            </div>
                          </ListRow>
                        ))
                      )}
                    </SidebarSection>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AiSettingsPage;

/* ──────────────── subcomponents ──────────────── */

function SidebarSection({
  icon: Icon, label, count, open, onToggle, action, children,
}: {
  icon: any; label: string; count: number; open: boolean;
  onToggle: () => void; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-black/5 select-none"
        style={{ color: C.textSubtle }}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[12px] font-semibold uppercase tracking-wide flex-1">{label}</span>
        <span className="text-[10px]" style={{ color: C.textMuted }}>{count}</span>
        {action}
      </div>
      {open && <div className="px-2 pb-2 space-y-1">{children}</div>}
    </div>
  );
}


function ListRow({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-2.5 py-2 rounded-md"
      style={{
        background: active ? "#EEF2FF" : "transparent",
        border: active ? `1px solid #C7D2FE` : "1px solid transparent",
        color: C.text,
      }}>
      {children}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="px-2 py-6 text-[12px] italic" style={{ color: C.textMuted }}>{text}</div>;
}

/* ──────────────── Detail panel ──────────────── */

function DetailPanel({
  law, draft, doc, onApproveDraft, onRejectDraft, onAskAboutLaw, onGenerateLawDocument,
}: {
  law: Law | null; draft: Law | null; doc: KnowledgeDoc | null;
  onApproveDraft: (d: Law) => void; onRejectDraft: (d: Law) => void;
  onAskAboutLaw: (prompt: string) => void;
  onGenerateLawDocument?: (l: Law) => void;
}) {
  if (law) {
    const history = Array.isArray(law.approval_history) ? law.approval_history : [];
    return (
      <div className="p-6 max-w-3xl">
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>
          Official Law · v{law.version ?? 1}
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>{law.name}</h2>
        <div className="rounded-md border p-3 text-sm mb-4"
          style={{ borderColor: C.border, background: C.panelBg, color: C.text }}>
          <MathText text={law.rule} />
        </div>
        {law.reason && (
          <Section title="Reasoning">
            <div className="text-sm" style={{ color: C.textSubtle }}><MathText text={law.reason} /></div>
          </Section>
        )}
        {(law.lesson_topics?.length ?? 0) > 0 && (
          <Section title="Topics">
            <div className="flex flex-wrap gap-1.5">
              {law.lesson_topics!.map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
          </Section>
        )}
        <Section title="Stats">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Times applied" value={String(law.usage_count ?? 0)} />
            <Stat label="Approved" value={law.created_at ? new Date(law.created_at).toLocaleDateString() : "—"} />
            <Stat label="History" value={String(history.length)} />
          </div>
        </Section>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAskAboutLaw(`Review "${law.name}". Explain it, give 2 examples, and flag any conflicts with other approved laws.`)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
            style={{ background: C.accent, color: C.accentText }}>
            <Sparkles className="h-3.5 w-3.5" /> Discuss with AI
          </button>
          <button
            onClick={() => onAskAboutLaw(`Propose an improvement or revision to "${law.name}" as a new draft law.`)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}>
            <Edit3 className="h-3.5 w-3.5" /> Suggest revision
          </button>
          {onGenerateLawDocument && (
            <button
              onClick={() => onGenerateLawDocument(law)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-black/5"
              style={{ borderColor: C.borderStrong, color: C.text }}>
              <FileText className="h-3.5 w-3.5" /> Generate Law Document
            </button>
          )}
        </div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: C.draft }}>
          Draft Law · awaiting approval
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>{draft.name}</h2>
        <div className="rounded-md border p-3 text-sm mb-4"
          style={{ borderColor: C.border, background: C.panelBg, color: C.text }}>
          <MathText text={draft.rule} />
        </div>
        {draft.reason && (
          <Section title="Why the AI proposed this">
            <div className="text-sm" style={{ color: C.textSubtle }}><MathText text={draft.reason} /></div>
          </Section>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={() => onApproveDraft(draft)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
            style={{ background: C.approve, color: "#FFFFFF" }}>
            <Check className="h-4 w-4" /> Approve
          </button>
          <button onClick={() => onRejectDraft(draft)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border"
            style={{ borderColor: C.reject, color: C.reject }}>
            <X className="h-4 w-4" /> Reject
          </button>
          <button onClick={() => onAskAboutLaw(`Refine this draft law before approval: "${draft.name}" — ${draft.rule}`)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}>
            <Edit3 className="h-4 w-4" /> Refine with AI
          </button>
        </div>
      </div>
    );
  }

  if (doc) {
    return <DocumentViewer doc={doc} onAskAboutLaw={onAskAboutLaw} />;
  }

  return null;
}

/* ──────────────── Document viewer ──────────────── */

function DocumentViewer({
  doc,
  onAskAboutLaw,
}: {
  doc: KnowledgeDoc;
  onAskAboutLaw: (prompt: string) => void;
}) {
  const [content, setContent] = useState<string | null>(doc.parsed_text ?? null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const isTextLike = useMemo(() => {
    const name = doc.filename.toLowerCase();
    const kind = (doc.kind || "").toLowerCase();
    return (
      kind.startsWith("text/") ||
      kind.includes("markdown") ||
      kind.includes("json") ||
      /\.(md|markdown|txt|json|csv|log|html?)$/i.test(name)
    );
  }, [doc.filename, doc.kind]);

  const isImage = useMemo(
    () => (doc.kind || "").toLowerCase().startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.filename),
    [doc.filename, doc.kind],
  );

  useEffect(() => {
    setContent(doc.parsed_text ?? null);
    setLoadError(null);
    setDownloadUrl(null);
    if (!doc.storage_path) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .storage.from("floating-knowledge")
          .createSignedUrl(doc.storage_path!, 3600);
        if (!cancelled && !error && data?.signedUrl) setDownloadUrl(data.signedUrl);
      } catch { /* ignore */ }
    })();
    if (!doc.parsed_text && isTextLike) {
      setLoading(true);
      (async () => {
        try {
          const { data, error } = await supabase
            .storage.from("floating-knowledge")
            .download(doc.storage_path!);
          if (error) throw error;
          const text = await data.text();
          if (!cancelled) setContent(text);
        } catch (e: any) {
          if (!cancelled) setLoadError(e?.message ?? "Could not load document content.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [doc.id, doc.parsed_text, doc.storage_path, isTextLike]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b sticky top-0 z-10" style={{ borderColor: C.border, background: C.panelBg }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-2">
            <FileText className="h-5 w-5 mt-0.5 shrink-0" style={{ color: C.textMuted }} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold break-words" style={{ color: C.text }}>
                {doc.filename}
              </h1>
              <div className="text-xs mt-1" style={{ color: C.textMuted }}>
                {doc.kind} · Uploaded {new Date(doc.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1" style={{ background: C.pageBg }}>
        <div className="max-w-3xl mx-auto px-8 py-8">
          <article
            className="rounded-lg border p-8 shadow-sm"
            style={{ background: C.panelBg, borderColor: C.border, color: C.text }}
          >
            {loading && (
              <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
              </div>
            )}
            {!loading && content && (
              <div
                className="whitespace-pre-wrap leading-relaxed text-[15px]"
                style={{ color: C.text, fontFamily: "'Source Serif Pro', Georgia, serif" }}
              >
                {content}
              </div>
            )}
            {!loading && !content && isImage && downloadUrl && (
              <img src={downloadUrl} alt={doc.filename} className="max-w-full h-auto rounded" />
            )}
            {!loading && !content && !isImage && (
              <div className="text-sm" style={{ color: C.textMuted }}>
                {loadError
                  ? `Preview unavailable: ${loadError}`
                  : `Preview not available for this file type (${doc.kind || "unknown"}). Use Export to download and view the original.`}
              </div>
            )}
          </article>

          {/* Actions — below the content */}
          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-wide mb-3" style={{ color: C.textMuted }}>
              Actions
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onAskAboutLaw(
                  content
                    ? `Scan the following document "${doc.filename}" and extract laws, definitions, rules, or exceptions. Propose each as a draft law I can approve.\n\n---\n${content}\n---`
                    : `Scan "${doc.filename}" and extract laws, definitions, rules, or exceptions. Propose each as a draft law I can approve.`,
                )}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
                style={{ background: C.accent, color: C.accentText }}
              >
                <ScanLine className="h-4 w-4" /> Scan for Laws
              </button>
              <button
                onClick={() => onAskAboutLaw(
                  content
                    ? `Summarise the following document "${doc.filename}" into a clear structured summary with key points.\n\n---\n${content}\n---`
                    : `Summarise "${doc.filename}".`,
                )}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border hover:bg-black/5"
                style={{ borderColor: C.borderStrong, color: C.text }}
              >
                <FileText className="h-4 w-4" /> Summarise
              </button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={doc.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border hover:bg-black/5"
                  style={{ borderColor: C.borderStrong, color: C.text }}
                >
                  <Download className="h-4 w-4" /> Export
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: C.textMuted }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5" style={{ borderColor: C.border, background: C.panelBg }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textMuted }}>{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{value}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border"
      style={{ borderColor: C.border, background: C.hover, color: C.textSubtle }}>
      {children}
    </span>
  );
}

/* ──────────────── KnowledgeChat ──────────────── */

interface ChatHandle { askExternal: (prompt: string) => void }

const MODE_LABELS: Record<ChatMode, { label: string; hint: string }> = {
  conversation: {
    label: "Conversation",
    hint: "General assistant — chat about anything.",
  },
  training: {
    label: "Training",
    hint: "Teaching mode — I will learn from what you share and offer to save it.",
  },
  extraction: {
    label: "Knowledge Extraction",
    hint: "Discovery mode — I will extract concepts, patterns, and propose laws.",
  },
};

function KnowledgeChat({
  handleRef, subsectionId, onAfterAction,
}: {
  handleRef?: (r: ChatHandle | null) => void;
  subsectionId?: string;
  onAfterAction?: () => void;
}) {
  const modeStorageKey = `floating-ai-mode:${subsectionId ?? "global"}`;
  const [mode, setMode] = useState<ChatMode>(() => {
    try {
      const v = localStorage.getItem(modeStorageKey);
      if (v === "training" || v === "extraction" || v === "conversation") return v;
    } catch { /* ignore */ }
    return "conversation";
  });
  useEffect(() => {
    try { localStorage.setItem(modeStorageKey, mode); } catch { /* ignore */ }
  }, [mode, modeStorageKey]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome", role: "assistant",
      text:
        "Hi — I'm your Floating Number AI. I'm a full general-purpose assistant with deep Floating Number expertise.\n\nSwitch modes beside the input: **Conversation** for free chat, **Training** to teach me, or **Knowledge Extraction** to mine documents and propose laws. Type, speak, drop files, or paste screenshots.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const voice = useVoiceInput((next) => setInput(next));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => { taRef.current?.focus(); }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      try {
        const data = await fileToBase64(f);
        const isImage = f.type.startsWith("image/");
        setAttachments((prev) => [...prev, {
          id: newId(),
          filename: f.name,
          mime: f.type || "application/octet-stream",
          data,
          isImage,
          previewUrl: isImage ? URL.createObjectURL(f) : undefined,
        }]);
      } catch (e: any) {
        toast({ title: "Could not attach", description: e?.message ?? String(e), variant: "destructive" });
      }
    }
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const t = prev.find((a) => a.id === id);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachments.length === 0) || busy) return;
    const userMsg: ChatMessage = {
      id: newId(), role: "user", text: text || "(see attachments)",
      attachments: attachments.map((a) => ({ filename: a.filename, isImage: a.isImage, previewUrl: a.previewUrl })),
    };
    const sentAttachments = attachments;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    voice.reset();
    setAttachments([]);
    setBusy(true);
    try {
      const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
      const { data, error } = await supabase.functions.invoke("floating-assistant", {
        body: {
          message: text,
          history,
          workspace: "knowledge",
          mode,
          lessonContext: null,
          attachments: sentAttachments.map((a) => ({
            filename: a.filename, mime: a.mime, data: a.data,
          })),
        },
      });
      if (error) {
        let body: any = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") body = await ctx.json();
          else if (ctx?.body) body = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
        } catch { /* ignore */ }
        const err = body?.error;
        if (err && typeof err === "object") {
          const tail = err.detail ? `\n\nDetails: ${err.detail}` : "";
          throw new Error(`${err.message || "The AI couldn't process that request."}${tail}`);
        }
        throw error;
      }
      const reply = (data as any)?.reply ?? "(no reply)";
      const { text: cleanText, actions } = parseActions(reply);
      setMessages((prev) => [...prev, {
        id: newId(), role: "assistant", text: cleanText, actions, mode,
      }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: `⚠️ ${e?.message ?? String(e)}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => taRef.current?.focus(), 0);
    }
  }, [input, busy, messages, attachments, voice, mode]);

  /* ───── Action button handlers (multi-select) ───── */
  const runActions = useCallback(async (msgId: string, selected: ChatAction[]) => {
    const msg = messages.find((m) => m.id === msgId);
    const body = msg?.text ?? "";
    const consume = () => setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, actions: [] } : m
    ));

    if (selected.length === 0) return;
    if (selected.length === 1 && selected[0].kind === "discard") {
      consume();
      toast({ title: "Discarded" });
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) { toast({ title: "Not signed in", variant: "destructive" }); return; }

    setBusy(true);
    const results: string[] = [];
    const failures: string[] = [];

    for (const action of selected) {
      try {
        if (action.kind === "discard") continue;

        if (action.kind === "save_knowledge") {
          const { error } = await supabase.from("floating_knowledge_documents").insert({
            owner_id: session.user.id,
            kind: "note",
            filename: `${action.title}.md`,
            parsed_text: body,
            metadata: { source: "chat", mode: msg?.mode ?? mode },
          } as any);
          if (error) throw error;
          results.push(`Saved to Knowledge: ${action.title}`);
        } else if (action.kind === "create_draft_law") {
          const { error } = await supabase.from("floating_law_drafts").insert({
            owner_id: session.user.id,
            name: action.name,
            rule: body.slice(0, 400),
            reason: `Proposed from ${msg?.mode ?? mode} session`,
            examples: [],
            exceptions: [],
            status: "proposed",
            source_kind: "ai_proposed",
          } as any);
          if (error) throw error;
          results.push(`Draft Law created: ${action.name}`);
        } else if (action.kind === "approve_official_law") {
          // find next law_number for this owner
          const { data: nextRow } = await supabase
            .from("floating_law_library")
            .select("law_number")
            .eq("owner_id", session.user.id)
            .order("law_number", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextNumber = ((nextRow as any)?.law_number ?? 0) + 1;
          const { error } = await supabase.from("floating_law_library").insert({
            owner_id: session.user.id,
            law_number: nextNumber,
            name: action.name,
            rule: body.slice(0, 600),
            reason: `Approved directly from ${msg?.mode ?? mode} session`,
            conditions: [],
            exceptions: [],
            lesson_topics: [],
            tags: [],
            approval_history: [{ at: new Date().toISOString(), action: "approved_from_chat" }],
          } as any);
          if (error) throw error;
          results.push(`Law ${nextNumber} approved: ${action.name}`);
        } else if (action.kind === "generate_document") {
          const { data, error } = await supabase.functions.invoke("floating-assistant", {
            body: {
              message: `Generate a COMPLETE teaching document titled "${action.title}" using the entire discussion content below. Include every section listed in DOCUMENT mode. Do not abbreviate.\n\n--- DISCUSSION CONTENT ---\n${body}`,
              mode: "document",
              workspace: "knowledge",
              lessonContext: null,
              history: [],
              attachments: [],
            },
          });
          if (error) throw error;
          const reply = (data as any)?.reply ?? "";
          const { error: insErr } = await supabase.from("floating_knowledge_documents").insert({
            owner_id: session.user.id,
            kind: "law_document",
            filename: `${action.title}.md`,
            parsed_text: reply,
            metadata: { source: "generated", title: action.title },
          } as any);
          if (insErr) throw insErr;
          results.push(`Document generated: ${action.title}`);
        }
      } catch (e: any) {
        failures.push(`${action.kind}: ${e?.message ?? String(e)}`);
      }
    }

    setBusy(false);
    if (results.length) toast({ title: "Actions complete", description: results.join(" • ") });
    if (failures.length) toast({ title: "Some actions failed", description: failures.join(" • "), variant: "destructive" });
    onAfterAction?.();
    consume();
  }, [messages, mode, onAfterAction]);

  useEffect(() => {
    const handle: ChatHandle = { askExternal: (p: string) => { setInput(""); voice.reset(); send(p); } };
    handleRef?.(handle);
    return () => handleRef?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  // Paste images from clipboard
  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (items && items.length) { addFiles(items); e.preventDefault(); }
  };

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
      style={{ outline: dragOver ? `2px dashed ${C.accent}` : "none", outlineOffset: -6 }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0"
        style={{ borderColor: C.border, background: C.panelBg }}>
        <Sparkles className="h-4 w-4" style={{ color: C.accent }} />
        <div className="text-sm font-semibold" style={{ color: C.text }}>Floating Number AI</div>
        <button
          disabled
          title="Real-time voice conversations — coming soon"
          className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border opacity-50 cursor-not-allowed"
          style={{ borderColor: C.border, color: C.textMuted }}
        >
          <Phone className="h-3.5 w-3.5" /> Call AI
        </button>
        <button
          onClick={() => {
            setMessages([{ id: "welcome", role: "assistant", text: "New conversation." }]);
            setAttachments([]);
          }}
          className="text-[11px] px-2 py-1 rounded hover:bg-black/5"
          style={{ color: C.textSubtle }}
        >
          <Plus className="h-3.5 w-3.5 inline -mt-0.5" /> New
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5"
        style={{ background: "#FAFAF7" }}>
        <div className="max-w-3xl mx-auto">
          {messages.map((m) => (
            <div key={m.id} className={`mb-5 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px]"
                style={{
                  background: m.role === "user" ? C.bubbleUser : "transparent",
                  color: m.role === "user" ? C.bubbleUserText : C.text,
                  border: m.role === "user" ? "none" : "none",
                }}
              >
                {m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {m.attachments.map((a, i) => a.isImage && a.previewUrl ? (
                      <img key={i} src={a.previewUrl} alt={a.filename}
                        className="h-20 rounded border" style={{ borderColor: C.border }} />
                    ) : (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded"
                        style={{
                          background: m.role === "user" ? "rgba(255,255,255,0.15)" : C.hover,
                          color: m.role === "user" ? C.bubbleUserText : C.textSubtle,
                        }}>
                        <Paperclip className="h-3 w-3" /> {a.filename}
                      </span>
                    ))}
                  </div>
                )}
                <MathText text={m.text} />
                {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                  <ActionPicker
                    actions={m.actions}
                    busy={busy}
                    onRun={(sel) => runActions(m.id, sel)}
                  />
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="p-3 border-t shrink-0" style={{ background: C.panelBg, borderColor: C.border }}>
        <div className="max-w-3xl mx-auto">
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachments.map((a) => (
                <div key={a.id} className="relative inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border"
                  style={{ borderColor: C.border, background: C.hover, color: C.textSubtle }}>
                  {a.isImage && a.previewUrl
                    ? <img src={a.previewUrl} alt="" className="h-6 w-6 object-cover rounded" />
                    : <Paperclip className="h-3 w-3" />}
                  <span className="max-w-[180px] truncate">{a.filename}</span>
                  <button onClick={() => removeAttachment(a.id)} className="hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="flex items-end gap-2 rounded-2xl border px-2 py-1.5"
            style={{ borderColor: C.borderStrong, background: "#FFFFFF" }}
          >
            <input ref={fileRef} type="file" multiple className="hidden"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />
            <input ref={imgRef} type="file" multiple className="hidden"
              accept="image/*"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />

            <button onClick={() => fileRef.current?.click()} title="Attach document"
              className="p-1.5 rounded-md hover:bg-black/5" style={{ color: C.textSubtle }}>
              <Paperclip className="h-4 w-4" />
            </button>
            <button onClick={() => imgRef.current?.click()} title="Attach image / screenshot"
              className="p-1.5 rounded-md hover:bg-black/5" style={{ color: C.textSubtle }}>
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              title={voice.listening ? "Stop voice" : "Voice input"}
              className="p-1.5 rounded-md hover:bg-black/5"
              style={{ color: voice.listening ? C.reject : C.textSubtle }}
            >
              {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Mode Selector */}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ChatMode)}
              title={MODE_LABELS[mode].hint}
              className="text-[11px] px-2 py-1 rounded-md border bg-transparent outline-none"
              style={{ borderColor: C.border, color: C.textSubtle }}
            >
              <option value="conversation">💬 Conversation</option>
              <option value="training">🎓 Training</option>
              <option value="extraction">🔍 Extraction</option>
            </select>

            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder={voice.listening ? "Listening…" : "Message Floating Number AI…  (Shift+Enter for newline)"}
              className="flex-1 resize-none bg-transparent outline-none text-sm py-1.5 max-h-40"
              style={{ color: C.text }}
            />
            <button
              onClick={() => send()}
              disabled={busy || (!input.trim() && attachments.length === 0)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg disabled:opacity-40"
              style={{ background: C.accent, color: C.accentText }}
              title="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-[10px] mt-1.5 text-center" style={{ color: C.textMuted }}>
            <span className="font-medium" style={{ color: mode === "conversation" ? C.textMuted : C.draft }}>
              {MODE_LABELS[mode].label} mode
            </span>
            {" · "}{MODE_LABELS[mode].hint}
          </div>
        </div>
      </div>
    </div>
  );
}

