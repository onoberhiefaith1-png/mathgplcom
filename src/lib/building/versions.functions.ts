/**
 * SAVE = CREATE THE NEXT BUILDING.
 *
 * A building is one complete environment: its rotating exterior together with
 * every hallway, door, room, lock, frame, window and screen inside it. Saving
 * from the editor must therefore NEVER write over the building that was opened.
 * It copies that whole package into a brand-new building and stores the exterior
 * as it looks right now on the copy, so Building 1 survives untouched and the
 * changes become Building 2.
 *
 * Learning content (courses, adventures, assignments) is only ever referenced,
 * so no copy ever duplicates or, when deleted, removes real content.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cloneBuildingPackage } from "./clone.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (client: unknown) => client as unknown as { from: (t: string) => any };

export const saveBuildingAsNew = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        sourceBuildingId: z.string().uuid(),
        orgId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(80),
        /** The rotating exterior exactly as it looks at the moment of saving. */
        exteriorConfig: z.unknown().optional(),
        thumbnailUrl: z.string().max(2000).nullable().optional(),
        /** Make the new building the one the workspace is standing in. */
        activate: z.boolean().optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // The source must be the caller's own building to copy from.
    const { data: allowed } = await context.supabase.rpc("can_edit_building", {
      _building_id: data.sourceBuildingId,
    });
    if (!allowed) throw new Error("You cannot save from that building.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAny(supabaseAdmin);

    const { buildingId } = await cloneBuildingPackage(db, data.sourceBuildingId, {
      ownerId: context.userId,
      orgId: data.orgId ?? null,
      name: data.name,
      isActive: false,
      keepContent: true,
    });

    // The exterior belongs to the NEW building only — the source keeps its own.
    await db
      .from("buildings")
      .update({
        exterior_config: (data.exteriorConfig ?? {}) as never,
        thumbnail_url: data.thumbnailUrl ?? null,
      })
      .eq("id", buildingId);

    if (data.activate) {
      await db
        .from("buildings")
        .update({ is_active: false })
        .eq("owner_id", context.userId)
        .neq("id", buildingId);
      await db.from("buildings").update({ is_active: true }).eq("id", buildingId);
    }

    return { buildingId };
  });
