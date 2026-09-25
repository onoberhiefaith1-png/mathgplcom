import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TRAIL, type FlowConfig, type FlowScope } from "./types";

export const FLOW_BUCKET = "flow-videos";
const flows = () => supabase.from("flows" as never) as any;
const notebooks = () => supabase.from("notebooks" as never) as any;

const normalize = (row: any, enabled = false): FlowConfig => ({
  id: row.id,
  notebook_id: row.id,
  owner_id: row.owner_id,
  name: row.name ?? "Untitled Flow",
  scope: (row.scope ?? "personal") as FlowScope,
  status: row.status ?? "draft",
  cover_path: row.cover_path ?? null,
  cover_type: row.cover_type ?? null,
  enabled,
  clips: Array.isArray(row?.clips) ? row.clips : [],
  scenes: Array.isArray(row?.scenes) ? row.scenes : [],
  trail: { ...DEFAULT_TRAIL, ...(row?.trail ?? {}) },
  position: { dx: 0, dy: 0, scale: 1, volume: 0.75, ...(row?.position ?? {}) },
});

const me = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

export const isAdmin = async () => {
  const uid = await me();
  if (!uid) return false;
  const { data } = await (supabase.from("user_roles" as never) as any).select("role").eq("user_id", uid).in("role", ["platform_owner", "co_admin"]).maybeSingle();
  return !!data;
};

export const canEditFlow = async (cfg: FlowConfig) => {
  if (cfg.scope === "mathgpl") return isAdmin();
  return cfg.owner_id === (await me());
};

export const listFlows = async (): Promise<FlowConfig[]> => {
  const { data } = await flows().select("*").order("created_at", { ascending: true });
  return (data ?? []).map((r: any) => normalize(r));
};

export const loadFlow = async (flowId: string): Promise<FlowConfig | null> => {
  const { data } = await flows().select("*").eq("id", flowId).maybeSingle();
  return data ? normalize(data) : null;
};

/** The Flow a lesson note references, with the note's own ON/OFF. */
export const loadNotebookFlow = async (notebookId: string): Promise<FlowConfig | null> => {
  const { data: nb } = await notebooks().select("flow_id, flow_enabled").eq("id", notebookId).maybeSingle();
  if (!nb?.flow_id) return null;
  const f = await loadFlow(nb.flow_id);
  return f ? { ...f, enabled: !!nb.flow_enabled } : null;
};

export const getNotebookFlowRef = async (notebookId: string) => {
  const { data } = await notebooks().select("flow_id, flow_enabled").eq("id", notebookId).maybeSingle();
  return { flowId: (data?.flow_id as string | null) ?? null, enabled: !!data?.flow_enabled };
};

export const setNotebookFlow = async (notebookId: string, patch: { flow_id?: string | null; flow_enabled?: boolean }) => {
  const { error } = await notebooks().update(patch).eq("id", notebookId);
  if (error) throw error;
};

export const createFlow = async (name: string, scope: FlowScope = "personal") => {
  const uid = await me();
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await flows()
    .insert({ name, scope, owner_id: uid, status: scope === "mathgpl" ? "draft" : "published", trail: DEFAULT_TRAIL })
    .select("*").single();
  if (error) throw error;
  return normalize(data);
};

export const deleteFlow = async (flowId: string) => {
  const { error } = await flows().delete().eq("id", flowId);
  if (error) throw error;
};

const payload = (r: any) => ({
  name: r.name, cover_path: r.cover_path, cover_type: r.cover_type,
  clips: r.clips, scenes: r.scenes, trail: r.trail, position: r.position,
});

/** Copy a MathGPL Flow into the user's private workspace (independent copy). */
export const copyFlow = async (flowId: string) => {
  const uid = await me();
  if (!uid) throw new Error("Not signed in");
  const { data: src, error: e1 } = await flows().select("*").eq("id", flowId).single();
  if (e1) throw e1;
  const { data, error } = await flows()
    .insert({ ...payload(src), scope: "personal", owner_id: uid, status: "published", source_flow_id: src.id })
    .select("*").single();
  if (error) throw error;
  return normalize(data);
};

/** Admin: publish (or update) a snapshot of a personal Flow in the MathGPL library. */
export const sendToLibrary = async (flowId: string) => {
  const uid = await me();
  if (!uid) throw new Error("Not signed in");
  const { data: src, error: e1 } = await flows().select("*").eq("id", flowId).single();
  if (e1) throw e1;
  const { data: existing } = await flows().select("id").eq("scope", "mathgpl").eq("source_flow_id", flowId).maybeSingle();
  if (existing) {
    const { error } = await flows().update({ ...payload(src), status: "published" }).eq("id", existing.id);
    if (error) throw error;
    return "updated" as const;
  }
  const { error } = await flows().insert({ ...payload(src), scope: "mathgpl", owner_id: uid, status: "published", source_flow_id: flowId });
  if (error) throw error;
  return "sent" as const;
};

export const saveFlow = async (cfg: FlowConfig) => {
  const { error } = await flows().update({
    name: cfg.name,
    status: cfg.status,
    cover_path: cfg.cover_path,
    cover_type: cfg.cover_type,
    clips: cfg.clips,
    scenes: cfg.scenes,
    trail: cfg.trail,
    position: cfg.position,
  }).eq("id", cfg.id);
  if (error) throw error;
};

const cache = new Map<string, { url: string; exp: number }>();
export const flowUrl = async (path: string) => {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  const { data } = await supabase.storage.from(FLOW_BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 3600_000 });
  return data.signedUrl;
};

export const uploadFlowClip = async (flowId: string, file: File) => {
  const uid = await me();
  if (!uid) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${uid}/${flowId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(FLOW_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
};

export const uploadFlowBlob = async (flowId: string, blob: Blob, ext: string) => {
  const uid = await me();
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/${flowId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(FLOW_BUCKET).upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return path;
};

export const videoDuration = (file: File) =>
  new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(isFinite(v.duration) ? v.duration : 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
