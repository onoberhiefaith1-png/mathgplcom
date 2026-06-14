export type SceneKind = "obstacle" | "door" | "vault";

export interface AdventureGame {
  id: string;
  owner_id: string;
  name: string;
  topic: string | null;
  subtopic: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundRef {
  /** "library" = built-in adventure asset, "url" = uploaded/external */
  kind: "library" | "url";
  /** library id, or asset URL */
  ref: string;
  label?: string;
}

export interface LayoutItem {
  id: string;
  /** what this slot renders */
  kind: "effect" | "progress" | "vault";
  /** asset URL for effects/vault icons (optional) */
  src?: string;
  label?: string;
  /** percentages relative to the scene frame (0-100) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** for vault: vault_id linking questions */
  vaultId?: string;
  /** for vault: reward coins */
  reward?: number;
}

export interface SceneLayout {
  items: LayoutItem[];
}

export interface AdventureScene {
  id: string;
  game_id: string;
  order_index: number;
  kind: SceneKind;
  title: string | null;
  background_ref: BackgroundRef | null;
  layout_json: SceneLayout;
  required_progress: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdventureSceneQuestion {
  id: string;
  scene_id: string;
  vault_id: string | null;
  order_index: number;
  question_payload: { prompt?: string; answer?: string; [k: string]: unknown };
  marks: number;
  claim_once: boolean;
  created_at: string;
  updated_at: string;
}
