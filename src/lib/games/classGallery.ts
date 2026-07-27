// One permanent Gallery canvas per class. Distinct from `games` — the Gallery
// is where student rewards accumulate over time. Reuses the same `GameCanvas`
// shape so the editor UI can be shared.
import { supabase } from "@/integrations/supabase/client";
import { GameCanvas, normalizeCanvas } from "./types";

export interface ClassGalleryRow {
  id: string;
  class_id: string;
  canvas: GameCanvas;
}

const emptyCanvas = (): GameCanvas =>
  normalizeCanvas({ scenes: [], activeSceneId: null, heightUnits: 1 } as unknown);

/** Read-only check: does this class already own a Gallery? Never creates one. */
export const classGalleryExists = async (classId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("class_galleries")
    .select("id")
    .eq("class_id", classId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
};

export const getOrCreateClassGallery = async (
  classId: string,
): Promise<ClassGalleryRow> => {
  const { data: existing, error: selErr } = await supabase
    .from("class_galleries")
    .select("id, class_id, canvas")
    .eq("class_id", classId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    return {
      id: (existing as { id: string }).id,
      class_id: classId,
      canvas: normalizeCanvas((existing as { canvas: unknown }).canvas),
    };
  }
  const { data, error } = await supabase
    .from("class_galleries")
    .insert({ class_id: classId, canvas: emptyCanvas() as never } as never)
    .select("id, class_id, canvas")
    .single();
  if (error) throw error;
  return {
    id: (data as { id: string }).id,
    class_id: classId,
    canvas: normalizeCanvas((data as { canvas: unknown }).canvas),
  };
};

export const saveClassGalleryCanvas = async (
  classId: string,
  canvas: GameCanvas,
): Promise<void> => {
  const { error } = await supabase
    .from("class_galleries")
    .update({ canvas: canvas as never })
    .eq("class_id", classId);
  if (error) throw error;
};
