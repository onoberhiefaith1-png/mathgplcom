/**
 * 3D ACADEMY WORLD — data contract.
 *
 * The database is the source of truth; the 3D renderer is only a view of it.
 * Nothing in the hierarchy is hard-coded: rooms, categories, topics, subtopics
 * and product placements are all rows a teacher creates.
 *
 * A placement is a REFERENCE to an existing product (course / game / adventure /
 * assessment). The canonical product row is never duplicated, and the same
 * product may be placed in as many locations as the teacher wants.
 */

export type AcademyProductKind = "course" | "game" | "adventure" | "assessment";

export const PRODUCT_KINDS: { value: AcademyProductKind; label: string }[] = [
  { value: "course", label: "Course" },
  { value: "game", label: "Game" },
  { value: "adventure", label: "Adventure" },
  { value: "assessment", label: "Assessment" },
];

export const ROOM_TYPES: { value: string; label: string }[] = [
  { value: "course", label: "Course room" },
  { value: "subject", label: "Subject room" },
  { value: "resource", label: "Resource room" },
  { value: "custom", label: "Custom room" },
];

export interface Academy {
  id: string;
  org_id: string | null;
  owner_id: string;
  name: string;
  welcome_message: string;
  featured_title: string;
  template: string;
}

export interface AcademyPlacement {
  id: string;
  subtopic_id: string;
  product_kind: AcademyProductKind;
  product_id: string;
  title_override: string | null;
  description_override: string | null;
  image_url: string | null;
  badge: string | null;
  position: number;
  is_featured: boolean;
  is_visible: boolean;
}

export interface AcademySubtopic {
  id: string;
  topic_id: string;
  name: string;
  description: string;
  image_url: string | null;
  position: number;
  is_visible: boolean;
  placements: AcademyPlacement[];
}

export interface AcademyTopic {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string | null;
  position: number;
  is_visible: boolean;
  subtopics: AcademySubtopic[];
}

export interface AcademyCategory {
  id: string;
  room_id: string;
  name: string;
  description: string;
  image_url: string | null;
  icon_url: string | null;
  accent: string | null;
  position: number;
  is_visible: boolean;
  topics: AcademyTopic[];
}

export interface AcademyRoom {
  id: string;
  academy_id: string;
  name: string;
  description: string;
  room_type: string;
  image_url: string | null;
  icon_url: string | null;
  accent: string | null;
  position: number;
  is_visible: boolean;
  categories: AcademyCategory[];
}

export interface AcademyTree {
  academy: Academy;
  rooms: AcademyRoom[];
  canEdit: boolean;
}

/** A product the teacher can place, resolved from its own canonical table. */
export interface AcademyProduct {
  kind: AcademyProductKind;
  id: string;
  title: string;
  description: string;
  /** Where opening this product takes the learner. */
  route: string;
}

/** Which level of the world the viewer is looking at. */
export type AcademyLevel = "hall" | "room" | "category" | "topic" | "subtopic";

/**
 * Where a placed product opens.
 *
 * Courses and games have workspace-level surfaces, so a showroom card opens
 * them directly. Adventures and assessments are run inside a class (they carry
 * class progress and marking), so they are displayed here but launched from the
 * learner's class — the card says so rather than offering a dead button.
 */
export const productRoute = (kind: AcademyProductKind, id: string): string => {
  switch (kind) {
    case "course":
      return `/academy/course/${id}`;
    case "game":
      return `/adventure/games/${id}`;
    default:
      return "";
  }
};
