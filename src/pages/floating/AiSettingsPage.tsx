// Floating Number Intelligence Center
// ============================================================
// A single workspace combining the law library, draft-law review,
// knowledge documents, and a full conversational AI that shares
// memory with the Floating Number Generation page AI (same edge
// function, same hydrated knowledge base, same DB).
//
// Layout:
//   ┌──────────────┬────────────────────────┬─────────────────┐
//   │ Left rail    │ Detail / placeholder   │ Chat assistant  │
//   │ (laws/drafts │ (selected law / draft  │ (floating-      │
//   │  /documents) │  / document detail)    │  assistant)     │
//   └──────────────┴────────────────────────┴─────────────────┘

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Trash2,
  BookOpen,
  FileText,
  FlaskConical,
  RefreshCw,
  Send,
  Sparkles,
  Check,
  X,
  Edit3,
  Plus,
  Search,
  ScanLine,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/* ──────────────── types ──────────────── */

type Tab = "official" | "drafts" | "knowledge";

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
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/* ──────────────── style tokens ──────────────── */

const C = {
  pageBg: "#F5F1E8",
  panelBg: "#FFFFFF",
  text: "#000000",
  textSubtle: "#374151",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  hover: "#F3F4F6",
  accent: "#1F2937",
  accentText: "#FFFFFF",
  approve: "#047857",
  reject: "#B91C1C",
  info: "#1D4ED8",
  draft: "#B45309",
  bubbleUser: "#EFF6FF",
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `m-${Math.random().toString(36).slice(2)}`;

/* ──────────────── page ──────────────── */

const AiSettingsPage = () => {
  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();

  const [tab, setTab] = useState<Tab>("official");
  const [official, setOfficial] = useState<Law[]>([]);
  const [drafts, setDrafts] = useState<Law[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState("");

  const [selectedLaw, setSelectedLaw] = useState<Law | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Law | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ───── load knowledge ───── */

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("floating_law_library").select("*").order("created_at", { ascending: false }),
      supabase
        .from("floating_law_drafts")
        .select("*")
        .eq("status", "proposed")
        .order("created_at", { ascending: false }),
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
      // Broadcast so the Generation page picks up the latest laws/drafts.
      try {
        const ch = supabase.channel("floating_knowledge_sync");
        await ch.subscribe();
        await ch.send({ type: "broadcast", event: "sync", payload: { at: Date.now() } });
        await supabase.removeChannel(ch);
      } catch { /* non-fatal */ }
      toast({ title: "AI knowledge synced", description: "Laws, drafts, and documents refreshed." });
    } finally {
      setSyncing(false);
    }
  }, [load]);

  /* ───── draft actions ───── */

  const approveDraft = async (d: Law) => {
    const { error } = await supabase.from("floating_law_library").insert({
      name: d.name,
      rule: d.rule,
      reason: d.reason ?? null,
      conditions: d.conditions ?? [],
      exceptions: d.exceptions ?? [],
      lesson_topics: d.lesson_topics ?? [],
      tags: d.tags ?? [],
      approval_history: [{ at: new Date().toISOString(), action: "approved", from_draft: d.id }],
    } as any);
    if (error) {
      toast({ title: "Approve failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("floating_law_drafts").update({ status: "approved" } as any).eq("id", d.id);
    toast({ title: "Law approved", description: d.name });
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
        owner_id: session.user.id,
        kind: file.type || "unknown",
        filename: file.name,
        storage_path: path,
      } as any);
      if (error) throw error;
      toast({ title: "Uploaded", description: file.name });
      load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (d: KnowledgeDoc) => {
    if (d.storage_path) await supabase.storage.from("floating-knowledge").remove([d.storage_path]);
    await supabase.from("floating_knowledge_documents").delete().eq("id", d.id);
    if (selectedDoc?.id === d.id) setSelectedDoc(null);
    load();
  };

  /* ───── filtering ───── */

  const filteredOfficial = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return official;
    return official.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.rule ?? "").toLowerCase().includes(q) ||
        (l.tags ?? []).some((t) => (t ?? "").toLowerCase().includes(q)),
    );
  }, [official, filter]);

  const filteredDrafts = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return drafts;
    return drafts.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.rule ?? "").toLowerCase().includes(q),
    );
  }, [drafts, filter]);

  const filteredDocs = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return docs;
    return docs.filter((d) => d.filename.toLowerCase().includes(q));
  }, [docs, filter]);

  /* ───── derived selection ───── */

  const detailKey =
    (selectedLaw && `law-${selectedLaw.id}`) ||
    (selectedDraft && `draft-${selectedDraft.id}`) ||
    (selectedDoc && `doc-${selectedDoc.id}`) ||
    null;

  /* ──────────────── render ──────────────── */

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.pageBg, color: C.text }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: C.panelBg, borderColor: C.border }}
      >
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
                Laws · Drafts · Knowledge · AI — shared with the Generation page
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
            title="Refresh laws, drafts and documents; notify Generation page"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync AI knowledge
          </button>
        </div>
      </div>

      {/* Body: 3 columns */}
      <div className="flex flex-1 min-h-0">
        {/* Left rail */}
        <aside
          className="w-[300px] shrink-0 flex flex-col border-r"
          style={{ background: C.panelBg, borderColor: C.border }}
        >
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: C.border }}>
            {([
              ["official", "Laws", BookOpen, official.length],
              ["drafts", "Drafts", FlaskConical, drafts.length],
              ["knowledge", "Docs", FileText, docs.length],
            ] as [Tab, string, any, number][]).map(([k, label, Icon, n]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs"
                style={{
                  borderBottom: tab === k ? `2px solid ${C.accent}` : "2px solid transparent",
                  color: tab === k ? C.accent : C.textMuted,
                  fontWeight: tab === k ? 600 : 400,
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{label} ({n})</span>
              </button>
            ))}
          </div>

          {/* Search + Upload */}
          <div className="px-3 py-2 border-b" style={{ borderColor: C.border }}>
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border"
              style={{ borderColor: C.border, background: C.hover }}
            >
              <Search className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="bg-transparent outline-none text-xs flex-1"
                style={{ color: C.text }}
              />
            </div>
            {tab === "knowledge" && (
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-md"
                  style={{ background: C.accent, color: C.accentText }}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload document
                </button>
              </>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="py-10 text-center text-xs" style={{ color: C.textMuted }}>
                <Loader2 className="h-4 w-4 animate-spin inline" />
              </div>
            ) : tab === "official" ? (
              filteredOfficial.length === 0 ? (
                <EmptyHint text="No approved laws yet. Approve drafts to grow the library." />
              ) : (
                <div className="space-y-1">
                  {filteredOfficial.map((l) => (
                    <ListRow
                      key={l.id}
                      active={selectedLaw?.id === l.id}
                      onClick={() => { setSelectedLaw(l); setSelectedDraft(null); setSelectedDoc(null); }}
                    >
                      <div className="font-medium text-[13px] truncate">{l.name}</div>
                      <div className="text-[11px] truncate" style={{ color: C.textMuted }}>{l.rule}</div>
                    </ListRow>
                  ))}
                </div>
              )
            ) : tab === "drafts" ? (
              filteredDrafts.length === 0 ? (
                <EmptyHint text="No pending drafts. The AI will propose drafts when it sees a new pattern." />
              ) : (
                <div className="space-y-1">
                  {filteredDrafts.map((d) => (
                    <ListRow
                      key={d.id}
                      active={selectedDraft?.id === d.id}
                      onClick={() => { setSelectedDraft(d); setSelectedLaw(null); setSelectedDoc(null); }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "#FEF3C7", color: C.draft }}
                        >
                          DRAFT
                        </span>
                        <div className="font-medium text-[13px] truncate flex-1">{d.name}</div>
                      </div>
                      <div className="text-[11px] truncate mt-0.5" style={{ color: C.textMuted }}>{d.rule}</div>
                    </ListRow>
                  ))}
                </div>
              )
            ) : (
              filteredDocs.length === 0 ? (
                <EmptyHint text="No knowledge documents yet. Upload PDFs, DOCX, images, or notes to teach the AI." />
              ) : (
                <div className="space-y-1">
                  {filteredDocs.map((d) => (
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
                  ))}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Detail column */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <DetailPanel
            key={detailKey ?? "none"}
            law={selectedLaw}
            draft={selectedDraft}
            doc={selectedDoc}
            onApproveDraft={approveDraft}
            onRejectDraft={rejectDraft}
            onAskAboutLaw={(prompt) => chatRef.current?.askExternal(prompt)}
          />
        </main>

        {/* Chat column */}
        <aside
          className="w-[440px] shrink-0 flex flex-col border-l"
          style={{ background: C.panelBg, borderColor: C.border }}
        >
          <KnowledgeChat ref={(r) => (chatRef.current = r)} />
        </aside>
      </div>
    </div>
  );

  // forward-ref handle to the chat so the detail panel can seed prompts
  function chatRefDecl() {}
};

// chat ref holder (declared outside JSX scope below)
const chatRef: { current: { askExternal: (p: string) => void } | null } = { current: null };

export default AiSettingsPage;

/* ──────────────── subcomponents ──────────────── */

function ListRow({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-2 rounded-md"
      style={{
        background: active ? "#EEF2FF" : "transparent",
        border: active ? `1px solid #C7D2FE` : "1px solid transparent",
        color: C.text,
      }}
    >
      {children}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="px-2 py-6 text-[12px] italic" style={{ color: C.textMuted }}>
      {text}
    </div>
  );
}

/* ──────────────── Detail panel ──────────────── */

function DetailPanel({
  law,
  draft,
  doc,
  onApproveDraft,
  onRejectDraft,
  onAskAboutLaw,
}: {
  law: Law | null;
  draft: Law | null;
  doc: KnowledgeDoc | null;
  onApproveDraft: (d: Law) => void;
  onRejectDraft: (d: Law) => void;
  onAskAboutLaw: (prompt: string) => void;
}) {
  if (!law && !draft && !doc) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <div className="max-w-md text-center" style={{ color: C.textMuted }}>
          <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: C.accent }} />
          <div className="text-sm font-medium mb-1" style={{ color: C.text }}>
            Select a law, draft, or document
          </div>
          <div className="text-xs">
            Open the chat on the right to review laws, propose new drafts, scan
            uploaded documents, or ask the AI anything about Floating Numbers. The
            AI here is the same assistant that powers the Floating Number
            Generation page — it shares all approved laws, drafts, and knowledge.
          </div>
        </div>
      </div>
    );
  }

  if (law) {
    const history = Array.isArray(law.approval_history) ? law.approval_history : [];
    return (
      <div className="p-6 max-w-3xl">
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>
          Official Law · v{law.version ?? 1}
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>{law.name}</h2>
        <div
          className="rounded-md border p-3 text-sm leading-relaxed mb-4"
          style={{ borderColor: C.border, background: C.hover, color: C.text }}
        >
          {law.rule}
        </div>
        {law.reason && (
          <Section title="Reasoning">
            <p className="text-sm" style={{ color: C.textSubtle }}>{law.reason}</p>
          </Section>
        )}
        {(law.lesson_topics?.length ?? 0) > 0 && (
          <Section title="Topics">
            <div className="flex flex-wrap gap-1.5">
              {law.lesson_topics!.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </Section>
        )}
        <Section title="Stats">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Times applied" value={String(law.usage_count ?? 0)} />
            <Stat label="Approved" value={law.created_at ? new Date(law.created_at).toLocaleDateString() : "—"} />
            <Stat label="History entries" value={String(history.length)} />
          </div>
        </Section>
        <Section title="Approval history">
          {history.length === 0 ? (
            <div className="text-xs italic" style={{ color: C.textMuted }}>
              {law.created_at ? `Initial approval on ${new Date(law.created_at).toLocaleString()}` : "No history recorded."}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {history.map((h: any, i: number) => (
                <li key={i} className="text-xs" style={{ color: C.textSubtle }}>
                  <span style={{ color: C.textMuted }}>{h.at ? new Date(h.at).toLocaleString() : "—"}</span>
                  {" · "}
                  <span>{h.action ?? "updated"}</span>
                  {h.from_draft && <span style={{ color: C.textMuted }}> · from draft {String(h.from_draft).slice(0, 8)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAskAboutLaw(`Review "${law.name}". Explain it, give 2 examples, and flag any conflicts with other approved laws.`)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
            style={{ background: C.accent, color: C.accentText }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Review with AI
          </button>
          <button
            onClick={() => onAskAboutLaw(`Propose an improvement or revision to "${law.name}" as a new draft law.`)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}
          >
            <Edit3 className="h-3.5 w-3.5" /> Suggest revision
          </button>
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
        <div
          className="rounded-md border p-3 text-sm leading-relaxed mb-4"
          style={{ borderColor: C.border, background: C.hover, color: C.text }}
        >
          {draft.rule}
        </div>
        {draft.reason && (
          <Section title="Why the AI proposed this">
            <p className="text-sm" style={{ color: C.textSubtle }}>{draft.reason}</p>
          </Section>
        )}
        {draft.source_kind && (
          <Section title="Source">
            <Chip>{draft.source_kind}{draft.source ? ` · ${draft.source}` : ""}</Chip>
          </Section>
        )}
        {(draft.lesson_topics?.length ?? 0) > 0 && (
          <Section title="Topics">
            <div className="flex flex-wrap gap-1.5">
              {draft.lesson_topics!.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </Section>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onApproveDraft(draft)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
            style={{ background: C.approve, color: "#FFFFFF" }}
          >
            <Check className="h-4 w-4" /> Approve & promote to official
          </button>
          <button
            onClick={() => onRejectDraft(draft)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border"
            style={{ borderColor: C.reject, color: C.reject }}
          >
            <X className="h-4 w-4" /> Reject
          </button>
          <button
            onClick={() => onAskAboutLaw(`Refine this draft law before approval: "${draft.name}" — ${draft.rule}`)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}
          >
            <Edit3 className="h-4 w-4" /> Refine with AI
          </button>
        </div>
      </div>
    );
  }

  if (doc) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>
          Knowledge document
        </div>
        <h2 className="text-xl font-semibold mb-2 break-all" style={{ color: C.text }}>{doc.filename}</h2>
        <div className="text-xs mb-4" style={{ color: C.textMuted }}>
          {doc.kind} · uploaded {new Date(doc.created_at).toLocaleString()}
        </div>
        <Section title="What the AI can do with this">
          <ul className="text-sm space-y-1.5" style={{ color: C.textSubtle }}>
            <li>• Extract candidate laws, definitions, rules and exceptions.</li>
            <li>• Summarise findings and propose them as draft laws for your approval.</li>
            <li>• Cite this document when applying a related law during generation.</li>
          </ul>
        </Section>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAskAboutLaw(
              `Scan the uploaded document "${doc.filename}" and extract any laws, definitions, rules, or exceptions you find. For each, propose a draft law I can approve.`,
            )}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
            style={{ background: C.accent, color: C.accentText }}
          >
            <ScanLine className="h-4 w-4" /> Scan for laws
          </button>
          <button
            onClick={() => onAskAboutLaw(`Summarise the key points of "${doc.filename}" for me.`)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border hover:bg-black/5"
            style={{ borderColor: C.borderStrong, color: C.text }}
          >
            <FileText className="h-4 w-4" /> Summarise
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: C.textMuted }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5" style={{ borderColor: C.border, background: C.hover }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textMuted }}>{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{value}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border"
      style={{ borderColor: C.border, background: C.hover, color: C.textSubtle }}
    >
      {children}
    </span>
  );
}

/* ──────────────── KnowledgeChat ──────────────── */

interface ChatHandle { askExternal: (prompt: string) => void }

const KnowledgeChat = (() => {
  // We use a normal function component but expose an imperative handle through a callback ref.
  const Component = (props: { ref?: (r: ChatHandle | null) => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
      {
        id: "welcome",
        role: "assistant",
        text:
          "Hi — I'm your Floating Number AI. I share the same memory as the assistant on the Floating Number Generation page. Ask me to review a law, compare two laws, propose a new draft, scan an uploaded document, or anything else about Floating Numbers.",
      },
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const taRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, busy]);

    useEffect(() => { taRef.current?.focus(); }, []);

    const send = useCallback(async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || busy) return;
      const userMsg: ChatMessage = { id: newId(), role: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setBusy(true);
      try {
        const history = messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
        const { data, error } = await supabase.functions.invoke("floating-assistant", {
          body: {
            message: text,
            history,
            workspace: "knowledge",
            lessonContext: null,
          },
        });
        if (error) throw error;
        const reply = (data as any)?.reply ?? "(no reply)";
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: reply }]);
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: `Error: ${e?.message ?? String(e)}` },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => taRef.current?.focus(), 0);
      }
    }, [input, busy, messages]);

    // expose askExternal through the callback ref
    useEffect(() => {
      const handle: ChatHandle = { askExternal: (p: string) => { setInput(""); send(p); } };
      props.ref?.(handle);
      return () => props.ref?.(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [send]);

    const quick = [
      "Review the most recent law.",
      "List all approved laws by topic.",
      "Compare the two most similar laws and flag conflicts.",
      "Propose a draft law from the latest uploaded document.",
    ];

    return (
      <div className="flex flex-col h-full">
        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ borderColor: C.border, background: C.panelBg }}
        >
          <Sparkles className="h-4 w-4" style={{ color: C.accent }} />
          <div className="text-sm font-semibold" style={{ color: C.text }}>Floating Number AI</div>
          <div className="text-[11px] ml-1" style={{ color: C.textMuted }}>Knowledge workspace</div>
          <button
            onClick={() => setMessages([{ id: "welcome", role: "assistant", text: "New conversation started." }])}
            className="ml-auto text-[11px] px-2 py-1 rounded hover:bg-black/5"
            style={{ color: C.textSubtle }}
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5 inline -mt-0.5" /> New
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3" style={{ background: "#FAFAFA" }}>
          {messages.map((m) => (
            <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                style={{
                  background: m.role === "user" ? C.bubbleUser : C.panelBg,
                  border: `1px solid ${m.role === "user" ? "#BFDBFE" : C.border}`,
                  color: C.text,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs" style={{ color: C.textMuted }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t" style={{ borderColor: C.border }}>
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={busy}
              className="text-[11px] px-2 py-1 rounded-md border hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: C.border, color: C.textSubtle }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Composer */}
        <div className="p-3" style={{ background: C.panelBg }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Ask the Floating Number AI…"
              className="flex-1 resize-none rounded-md border px-2.5 py-2 text-sm outline-none"
              style={{ borderColor: C.border, color: C.text, background: "#FFFFFF" }}
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md disabled:opacity-50"
              style={{ background: C.accent, color: C.accentText }}
              title="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  };
  return Component;
})();
