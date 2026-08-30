/**
 * 3D ACADEMY WORLD — data access.
 *
 * Every read and write goes through the signed-in Supabase client, so the
 * database RLS policies (can_view_academy / can_edit_academy) are the single
 * security boundary: students and parents physically cannot write, whatever the
 * UI renders.
 *
 * The renderer never invents structure — it draws exactly what these functions
 * return.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Academy,
  AcademyCategory,
  AcademyPlacement,
  AcademyProduct,
  AcademyProductKind,
  AcademyRoom,
  AcademySubtopic,
  AcademyTopic,
  AcademyTree,
} from "./types";
import { productRoute } from "./types";

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/**
 * The workspace's academy, created on first visit by whoever may edit it.
 * One academy per workspace (org), or per account when there is no org.
 */
export async function ensureAcademy(orgId: string | null): Promise<Academy | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const existing = orgId
    ? await supabase.from("academies").select("*").eq("org_id", orgId).maybeSingle()
    : await supabase.from("academies").select("*").eq("owner_id", uid).is("org_id", null).maybeSingle();
  if (existing.data) return existing.data as Academy;

  const insert = await supabase
    .from("academies")
    .insert({ org_id: orgId, owner_id: uid })
    .select("*")
    .maybeSingle();
  if (insert.data) return insert.data as Academy;

  // A teammate may have created it in the same moment — read it back.
  const retry = orgId
    ? await supabase.from("academies").select("*").eq("org_id", orgId).maybeSingle()
    : await supabase.from("academies").select("*").eq("owner_id", uid).is("org_id", null).maybeSingle();
  return (retry.data as Academy | null) ?? null;
}

export async function canEditAcademy(academyId: string): Promise<boolean> {
  const { data } = await supabase.rpc("can_edit_academy", { _academy_id: academyId });
  return Boolean(data);
}

/** The whole structure of one academy, ordered exactly as stored. */
export async function loadAcademyTree(academy: Academy): Promise<AcademyTree> {
  const [roomsRes, canEdit] = await Promise.all([
    supabase.from("academy_rooms").select("*").eq("academy_id", academy.id).order("position"),
    canEditAcademy(academy.id),
  ]);
  fail(roomsRes.error);
  const rooms = (roomsRes.data ?? []) as Omit<AcademyRoom, "categories">[];
  if (rooms.length === 0) return { academy, rooms: [], canEdit };

  const roomIds = rooms.map((r) => r.id);
  const catRes = await supabase
    .from("academy_categories")
    .select("*")
    .in("room_id", roomIds)
    .order("position");
  fail(catRes.error);
  const categories = (catRes.data ?? []) as Omit<AcademyCategory, "topics">[];

  const catIds = categories.map((c) => c.id);
  const topRes = catIds.length
    ? await supabase.from("academy_topics").select("*").in("category_id", catIds).order("position")
    : { data: [], error: null };
  fail(topRes.error);
  const topics = (topRes.data ?? []) as Omit<AcademyTopic, "subtopics">[];

  const topicIds = topics.map((t) => t.id);
  const subRes = topicIds.length
    ? await supabase.from("academy_subtopics").select("*").in("topic_id", topicIds).order("position")
    : { data: [], error: null };
  fail(subRes.error);
  const subtopics = (subRes.data ?? []) as Omit<AcademySubtopic, "placements">[];

  const subIds = subtopics.map((s) => s.id);
  const plcRes = subIds.length
    ? await supabase.from("academy_placements").select("*").in("subtopic_id", subIds).order("position")
    : { data: [], error: null };
  fail(plcRes.error);
  const placements = (plcRes.data ?? []) as AcademyPlacement[];

  const subWith: AcademySubtopic[] = subtopics.map((s) => ({
    ...s,
    placements: placements.filter((p) => p.subtopic_id === s.id),
  }));
  const topWith: AcademyTopic[] = topics.map((t) => ({
    ...t,
    subtopics: subWith.filter((s) => s.topic_id === t.id),
  }));
  const catWith: AcademyCategory[] = categories.map((c) => ({
    ...c,
    topics: topWith.filter((t) => t.category_id === c.id),
  }));
  const roomsWith: AcademyRoom[] = rooms.map((r) => ({
    ...r,
    categories: catWith.filter((c) => c.room_id === r.id),
  }));

  return { academy, rooms: roomsWith, canEdit };
}

// ── Generic level writes ──────────────────────────────────────────────────
// One implementation for every level: the only difference is the table and the
// name of the parent column, so a new level would be a two-line addition.

export type AcademyLevelTable =
  | "academy_rooms"
  | "academy_categories"
  | "academy_topics"
  | "academy_subtopics"
  | "academy_placements";

const PARENT_COLUMN: Record<AcademyLevelTable, string> = {
  academy_rooms: "academy_id",
  academy_categories: "room_id",
  academy_topics: "category_id",
  academy_subtopics: "topic_id",
  academy_placements: "subtopic_id",
};

const nextPosition = async (table: AcademyLevelTable, parentId: string): Promise<number> => {
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(PARENT_COLUMN[table], parentId)
    .order("position", { ascending: false })
    .limit(1);
  const top = (data ?? [])[0] as { position: number } | undefined;
  return (top?.position ?? -1) + 1;
};

export async function createNode(
  table: AcademyLevelTable,
  parentId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const position = await nextPosition(table, parentId);
  const { data, error } = await supabase
    .from(table)
    .insert({
      [PARENT_COLUMN[table]]: parentId,
      position,
      created_by: userData.user?.id ?? null,
      ...fields,
    } as never)
    .select("id")
    .maybeSingle();
  fail(error);
  return (data as { id: string } | null)?.id ?? "";
}

export async function updateNode(
  table: AcademyLevelTable,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(table).update(fields as never).eq("id", id);
  fail(error);
}

/** Deleting a placement removes the display only — never the product itself. */
export async function deleteNode(table: AcademyLevelTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  fail(error);
}

/** Persist a new order. `ids` is the full sibling list in its new order. */
export async function reorderNodes(table: AcademyLevelTable, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, index) => supabase.from(table).update({ position: index } as never).eq("id", id)),
  );
}

/** Re-parent a node (move a course to another subtopic, a topic to another category…). */
export async function moveNode(
  table: AcademyLevelTable,
  id: string,
  newParentId: string,
): Promise<void> {
  const position = await nextPosition(table, newParentId);
  const { error } = await supabase
    .from(table)
    .update({ [PARENT_COLUMN[table]]: newParentId, position } as never)
    .eq("id", id);
  fail(error);
}

export async function duplicateRoom(room: AcademyRoom): Promise<void> {
  const newRoomId = await createNode("academy_rooms", room.academy_id, {
    name: `${room.name} (copy)`,
    description: room.description,
    room_type: room.room_type,
    image_url: room.image_url,
    icon_url: room.icon_url,
    accent: room.accent,
    is_visible: room.is_visible,
  });
  for (const category of room.categories) {
    const catId = await createNode("academy_categories", newRoomId, {
      name: category.name,
      description: category.description,
      image_url: category.image_url,
      icon_url: category.icon_url,
      accent: category.accent,
      is_visible: category.is_visible,
    });
    for (const topic of category.topics) {
      const topId = await createNode("academy_topics", catId, {
        name: topic.name,
        description: topic.description,
        image_url: topic.image_url,
        is_visible: topic.is_visible,
      });
      for (const sub of topic.subtopics) {
        const subId = await createNode("academy_subtopics", topId, {
          name: sub.name,
          description: sub.description,
          image_url: sub.image_url,
          is_visible: sub.is_visible,
        });
        for (const placement of sub.placements) {
          await createNode("academy_placements", subId, {
            product_kind: placement.product_kind,
            product_id: placement.product_id,
            title_override: placement.title_override,
            description_override: placement.description_override,
            image_url: placement.image_url,
            badge: placement.badge,
            is_featured: placement.is_featured,
            is_visible: placement.is_visible,
          });
        }
      }
    }
  }
}

export async function updateAcademy(id: string, fields: Partial<Academy>): Promise<void> {
  const { error } = await supabase.from("academies").update(fields).eq("id", id);
  fail(error);
}

// ── Product catalogue ─────────────────────────────────────────────────────

/**
 * Everything the signed-in account may place, read from the products' own
 * tables. RLS decides what is visible; nothing here is copied.
 */
export async function loadProductCatalogue(): Promise<AcademyProduct[]> {
  const [courses, games, adventures, assessments] = await Promise.all([
    supabase.from("courses").select("id, title, description").order("created_at", { ascending: false }).limit(300),
    supabase.from("games").select("id, title").order("created_at", { ascending: false }).limit(300),
    supabase.from("adventure_games").select("id, name, description").order("created_at", { ascending: false }).limit(300),
    supabase.from("assessments").select("id, title").order("created_at", { ascending: false }).limit(300),
  ]);

  const out: AcademyProduct[] = [];
  for (const row of (courses.data ?? []) as { id: string; title: string; description: string | null }[]) {
    out.push({ kind: "course", id: row.id, title: row.title || "Untitled course", description: row.description ?? "", route: productRoute("course", row.id) });
  }
  for (const row of (games.data ?? []) as { id: string; title: string | null }[]) {
    out.push({ kind: "game", id: row.id, title: row.title || "Untitled game", description: "", route: productRoute("game", row.id) });
  }
  for (const row of (adventures.data ?? []) as { id: string; name: string | null; description: string | null }[]) {
    out.push({ kind: "adventure", id: row.id, title: row.name || "Untitled adventure", description: row.description ?? "", route: productRoute("adventure", row.id) });
  }
  for (const row of (assessments.data ?? []) as { id: string; title: string | null }[]) {
    out.push({ kind: "assessment", id: row.id, title: row.title || "Assessment", description: "", route: productRoute("assessment", row.id) });
  }
  return out;
}

export const productLabel = (
  catalogue: AcademyProduct[],
  kind: AcademyProductKind,
  id: string,
): AcademyProduct | undefined => catalogue.find((p) => p.kind === kind && p.id === id);
