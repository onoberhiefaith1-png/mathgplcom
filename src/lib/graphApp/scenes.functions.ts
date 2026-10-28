import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Controls a teacher allows students when a scene is shared. */
export const controlsSchema = z.object({
  editEquations: z.boolean(),
  tools: z.boolean(),
  console: z.boolean(),
});
export type SceneControls = z.infer<typeof controlsSchema>;

const snapshotSchema = z.object({
  equations: z.array(z.object({ src: z.string().max(500), colour: z.string().max(30), hidden: z.boolean().optional() })).max(50),
  mode: z.enum(["2D", "3D", "ND"]),
  view: z.object({ cx: z.number(), cy: z.number(), scale: z.number() }),
  grid: z.boolean(),
  axes: z.boolean(),
  labels: z.boolean(),
  ndN: z.number().int().min(4).max(6),
  ndAngle: z.number(),
  matrices: z.object({ a: z.array(z.array(z.number())), b: z.array(z.array(z.number())) }),
  calculus: z.object({ src: z.string().max(500), x: z.number(), lower: z.number(), upper: z.number() }),
});

// math_lab_scenes / math_lab_scene_shares are added by a staged migration that
// applies when the draft is accepted, so they are not in the generated types
// yet. Query them through a loosely typed alias until the types regenerate.
/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseDb = { from: (table: string) => any };
const db = (supabase: unknown) => supabase as LooseDb;

export type SceneSnapshot = z.infer<typeof snapshotSchema>;
export interface SharedSceneSummary { id: string; name: string; updated_at: string }
export interface MathLabScene { id: string; name: string; snapshot: SceneSnapshot; controls: SceneControls; owner_id: string }
export interface MySceneRow { id: string; name: string; updated_at: string; controls: SceneControls; snapshot: SceneSnapshot; math_lab_scene_shares: { class_id: string }[] }

export const saveMathLabScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        snapshot: snapshotSchema,
        controls: controlsSchema,
        classIds: z.array(z.string().uuid()).max(50),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: scene, error } = await db(supabase)
      .from("math_lab_scenes")
      .insert({ owner_id: userId, name: data.name, snapshot: data.snapshot, controls: data.controls })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.classIds.length) {
      const rows = data.classIds.map((class_id) => ({ scene_id: scene.id, class_id }));
      const { error: shareError } = await db(supabase).from("math_lab_scene_shares").insert(rows);
      if (shareError) throw new Error(shareError.message);
    }
    return { id: scene.id as string };
  });

export const listMyMathLabScenes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySceneRow[]> => {
    const { data, error } = await db(context.supabase)
      .from("math_lab_scenes")
      .select("id, name, updated_at, controls, snapshot, math_lab_scene_shares(class_id)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MySceneRow[];
  });

export const deleteMathLabScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).from("math_lab_scenes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Scenes shared with classes the signed-in student belongs to. */
export const listSharedMathLabScenes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharedSceneSummary[]> => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase.from("class_members").select("class_id").eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const classIds = (memberships ?? []).map((m) => m.class_id);
    if (!classIds.length) return [];
    const { data, error } = await db(supabase)
      .from("math_lab_scene_shares")
      .select("class_id, math_lab_scenes(id, name, updated_at)")
      .in("class_id", classIds);
    if (error) throw new Error(error.message);
    const seen = new Map<string, SharedSceneSummary>();
    for (const row of (data ?? []) as { math_lab_scenes?: SharedSceneSummary | null }[]) {
      const scene = row.math_lab_scenes;
      if (scene && !seen.has(scene.id)) seen.set(scene.id, scene);
    }
    return [...seen.values()];
  });

/** Open one scene. RLS allows the owner and members of shared classes. */
export const getMathLabScene = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<MathLabScene> => {
    const { data: scene, error } = await db(context.supabase)
      .from("math_lab_scenes")
      .select("id, name, snapshot, controls, owner_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return scene as MathLabScene;
  });
