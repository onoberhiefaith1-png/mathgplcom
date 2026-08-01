/**
 * Teacher-private Asset Library.
 *
 * Any diagram drawn in a lesson note (2D geometry, 3D scene, parametric
 * visual, AI-generated) can be saved here as a reusable asset. A custom asset
 * is nothing more than the ProseMirror node of the original object plus a
 * Standard Name, a Short Code and one of the five library sections — so
 * inserting it later restores the exact same live object.
 *
 * Only the owner can see their custom assets. Sharing one with MathGPL
 * Community publishes it as a `lesson_asset`, where it lands in the same
 * section on the community side.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AssetCategory, AssetDef } from "./types";
import { normaliseShortCode } from "./overrides";

export const LIBRARY_SECTIONS = [
  { id: "symbols", label: "Mathematical Symbols", category: "Symbols" },
  { id: "structures", label: "Elastic Math Structures", category: "Structures" },
  { id: "diagrams", label: "Parametric Vector Diagrams", category: "Diagrams" },
  { id: "tables", label: "Tabular Grids & Data Charts", category: "Tables" },
  { id: "manipulatives", label: "Interactive Manipulatives", category: "Manipulatives" },
] as const satisfies readonly { id: string; label: string; category: AssetCategory }[];

export type LibrarySectionId = (typeof LIBRARY_SECTIONS)[number]["id"];

export const DEFAULT_SECTION: LibrarySectionId = "diagrams";

export const sectionLabel = (id: string) =>
  LIBRARY_SECTIONS.find((s) => s.id === id)?.label ?? "Parametric Vector Diagrams";

const sectionCategory = (id: string): AssetCategory =>
  LIBRARY_SECTIONS.find((s) => s.id === id)?.category ?? "Diagrams";

export type CustomAssetSource = "2d" | "3d" | "ai" | "visual" | "other";

export interface CustomAssetRow {
  id: string;
  name: string;
  short_code: string;
  section: string;
  source: string;
  payload: { node?: unknown } | null;
  created_at: string;
}

/** The node snapshot a diagram hands over when the teacher saves it. */
export interface AssetSnapshot {
  /** ProseMirror node JSON — inserted verbatim when reused. */
  node: unknown;
  /** Suggested Standard Name. */
  suggestedName: string;
  source: CustomAssetSource;
  suggestedSection?: LibrarySectionId;
}

export const listMyCustomAssets = async (): Promise<CustomAssetRow[]> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("custom_assets")
    .select("id, name, short_code, section, source, payload, created_at")
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CustomAssetRow[];
};

export const createCustomAsset = async (input: {
  name: string;
  shortCode: string;
  section: LibrarySectionId | string;
  source: CustomAssetSource;
  node: unknown;
}): Promise<CustomAssetRow> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const name = input.name.trim();
  const shortCode = normaliseShortCode(input.shortCode);
  if (!name) throw new Error("Standard Name cannot be empty.");
  if (!shortCode) throw new Error("Short Code cannot be empty.");

  const { data, error } = await supabase
    .from("custom_assets")
    .insert({
      owner_id: uid,
      name,
      short_code: shortCode,
      section: input.section,
      source: input.source,
      payload: { node: input.node } as never,
    } as never)
    .select("id, name, short_code, section, source, payload, created_at")
    .single();
  if (error) throw error;
  return data as unknown as CustomAssetRow;
};

export const deleteCustomAsset = async (id: string) => {
  const { error } = await supabase.from("custom_assets").delete().eq("id", id);
  if (error) throw error;
};

/** A saved asset behaves exactly like a registry asset in every menu. */
export const customAssetToDef = (row: CustomAssetRow): AssetDef => ({
  id: `custom:${row.id}`,
  label: row.name,
  shortCode: row.short_code,
  category: sectionCategory(row.section),
  group: sectionLabel(row.section),
  keywords: [row.name.toLowerCase(), row.short_code.toLowerCase(), "my asset", "custom"],
  render: { kind: "node", node: row.payload?.node ?? null },
  hint: "My asset",
});
