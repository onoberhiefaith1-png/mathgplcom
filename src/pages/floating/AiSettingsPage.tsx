// AI Settings & Knowledge Base — minimal first cut. Tabs:
//   Official Laws | Draft Laws | Knowledge Documents
// Reads from the existing floating_law_library, floating_law_drafts, and
// the new floating_knowledge_documents table. Uploads land in the
// floating-knowledge storage bucket under the teacher's user-id folder.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Tab = "official" | "drafts" | "knowledge";

interface Law {
  id: string;
  name: string;
  rule: string;
  conditions: any;
  exceptions: any;
  version?: number;
  created_at?: string;
}

interface KnowledgeDoc {
  id: string;
  kind: string;
  filename: string;
  storage_path: string | null;
  created_at: string;
}

const AiSettingsPage = () => {
  const navigate = useNavigate();
  const { notebookId, subsectionId } = useParams<{ notebookId: string; subsectionId: string }>();
  const [tab, setTab] = useState<Tab>("official");
  const [official, setOfficial] = useState<Law[]>([]);
  const [drafts, setDrafts] = useState<Law[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("floating_law_library").select("*").order("created_at", { ascending: false }),
      supabase.from("floating_law_drafts").select("*").order("created_at", { ascending: false }),
      supabase.from("floating_knowledge_documents").select("*").order("created_at", { ascending: false }),
    ]);
    setOfficial((a.data as Law[]) ?? []);
    setDrafts((b.data as Law[]) ?? []);
    setDocs((c.data as KnowledgeDoc[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveDraft = async (d: Law) => {
    const { error } = await supabase.from("floating_law_library").insert({
      name: d.name,
      rule: d.rule,
      conditions: d.conditions ?? [],
      exceptions: d.exceptions ?? [],
    } as any);
    if (error) { toast({ title: "Approve failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("floating_law_drafts").update({ status: "approved" } as any).eq("id", d.id);
    toast({ title: "Law approved", description: d.name });
    load();
  };

  const rejectDraft = async (d: Law) => {
    await supabase.from("floating_law_drafts").update({ status: "rejected" } as any).eq("id", d.id);
    toast({ title: "Draft rejected" });
    load();
  };

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
    load();
  };

  return (
    <div className="min-h-screen" style={{ background: "hsl(38 35% 92%)" }}>
      <div className="max-w-4xl mx-auto px-6 py-6">
        <button
          onClick={() => navigate(`/lesson-notes/${notebookId}/floating/${subsectionId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to workspace
        </button>
        <h1 className="text-2xl font-semibold mb-4" style={{ color: "hsl(220 35% 18%)" }}>
          AI Settings &amp; Knowledge Base
        </h1>

        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
          {([
            ["official", `Official Laws (${official.length})`],
            ["drafts", `Draft Laws (${drafts.length})`],
            ["knowledge", `Knowledge (${docs.length})`],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-4 py-2 text-sm border-b-2 -mb-[1px]"
              style={{
                borderColor: tab === k ? "hsl(220 35% 18%)" : "transparent",
                color: tab === k ? "hsl(220 35% 18%)" : "hsl(220 15% 45%)",
                fontWeight: tab === k ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : tab === "official" ? (
          <div className="space-y-2">
            {official.length === 0 ? (
              <div className="text-sm text-foreground/55 italic">No laws approved yet.</div>
            ) : official.map((l) => (
              <div key={l.id} className="rounded-md bg-background p-3 border" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
                <div className="font-semibold text-sm">{l.name} <span className="text-xs text-foreground/45">v{l.version ?? 1}</span></div>
                <div className="text-xs text-foreground/70 mt-1">{l.rule}</div>
              </div>
            ))}
          </div>
        ) : tab === "drafts" ? (
          <div className="space-y-2">
            {drafts.length === 0 ? (
              <div className="text-sm text-foreground/55 italic">No pending drafts.</div>
            ) : drafts.map((d) => (
              <div key={d.id} className="rounded-md bg-background p-3 border" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
                <div className="font-semibold text-sm">{d.name}</div>
                <div className="text-xs text-foreground/70 mt-1">{d.rule}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => approveDraft(d)} className="text-xs px-2 py-1 rounded-md" style={{ background: "hsl(150 60% 38%)", color: "hsl(38 38% 96%)" }}>Approve</button>
                  <button onClick={() => rejectDraft(d)} className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: "hsl(0 60% 50%)", color: "hsl(0 60% 40%)" }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
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
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md"
                style={{ background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload law document, screenshot, or notes
              </button>
            </div>
            <div className="space-y-1.5">
              {docs.length === 0 ? (
                <div className="text-sm text-foreground/55 italic">No knowledge documents yet.</div>
              ) : docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-md bg-background p-2 border" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
                  <div className="flex-1">
                    <div className="text-sm">{d.filename}</div>
                    <div className="text-[11px] text-foreground/45">{d.kind} · {new Date(d.created_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => deleteDoc(d)} className="p-1.5 rounded hover:bg-foreground/5" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiSettingsPage;
