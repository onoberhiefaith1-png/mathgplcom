import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUILDING_COLLECTION, collectionBlueprint, type CollectionInstallRow } from "./collection";

/**
 * Install the ten-building collection for the signed-in administrator and
 * publish it to the Public (official) gallery. Runs with the caller's own
 * session: the database function checks the administrator role itself and
 * does the whole install in one transaction, so no service key is involved
 * and nothing secret reaches the browser. Safe to repeat.
 */
export const installBuildingCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const templates = BUILDING_COLLECTION.map((theme) => collectionBlueprint(theme));
    const { data, error } = await context.supabase.rpc("install_building_collection" as never, {
      _templates: templates,
    } as never);
    if (error) {
      if (error.code === "42501") throw new Error("Only building administrators can install the collection.");
      if (/function .*install_building_collection/i.test(error.message)) {
        throw new Error("The collection installer is not deployed to this database yet.");
      }
      throw new Error(error.message);
    }
    return data as unknown as CollectionInstallRow[];
  });
