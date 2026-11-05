// Labels placed on a game. Shares of the stage, so a saved label is the same
// on another screen, in Play, and on a copied template.

export interface GameTextLabel {
  id: string;
  text: string;
  /** 0–100 across the game frame. */
  x: number;
  y: number;
  /** Letter size in pixels, the size the teacher is looking at. */
  size: number;
  /** CSS colour. */
  colour: string;
}

export const TEXT_LABEL_LIMIT = 24;
export const TEXT_LABEL_SIZE = { min: 12, max: 96, fallback: 32 };

const clamp = (value: unknown, low: number, high: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(high, Math.max(low, n));
};

const COLOUR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;

export const textLabelColour = (value: unknown, fallback = "#173f91"): string =>
  typeof value === "string" && COLOUR.test(value.trim()) ? value.trim() : fallback;

export const normalizeTextLabel = (value: unknown, index: number): GameTextLabel | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : `label-${index}`;
  const text = typeof row.text === "string" ? row.text.slice(0, 400) : "";
  return {
    id,
    text,
    x: clamp(row.x, 2, 98, 50),
    y: clamp(row.y, 2, 98, 16),
    size: clamp(row.size, TEXT_LABEL_SIZE.min, TEXT_LABEL_SIZE.max, TEXT_LABEL_SIZE.fallback),
    colour: textLabelColour(row.colour),
  };
};

export const normalizeTextLabels = (value: unknown): GameTextLabel[] => {
  if (!Array.isArray(value)) return [];
  const labels: GameTextLabel[] = [];
  for (const entry of value) {
    if (labels.length >= TEXT_LABEL_LIMIT) break;
    const label = normalizeTextLabel(entry, labels.length);
    if (label) labels.push(label);
  }
  return labels;
};

/** The letters themselves: this is the live size and colour preview. */
export const textLabelStyle = (label: Pick<GameTextLabel, "size" | "colour">): { fontSize: string; color: string } => ({
  fontSize: `${label.size}px`,
  color: label.colour,
});

export const textLabelPlacement = (label: Pick<GameTextLabel, "x" | "y">): { left: string; top: string } => ({
  left: `${label.x}%`,
  top: `${label.y}%`,
});

export const createTextLabel = (id: string, partial?: Partial<GameTextLabel>): GameTextLabel =>
  normalizeTextLabel({
    id,
    text: "Text",
    x: 50,
    y: 16,
    size: TEXT_LABEL_SIZE.fallback,
    colour: "#173f91",
    ...partial,
  }, 0) as GameTextLabel;

export const updateTextLabel = (
  labels: GameTextLabel[],
  id: string,
  patch: Partial<Pick<GameTextLabel, "text" | "size" | "colour" | "x" | "y">>,
): GameTextLabel[] =>
  normalizeTextLabels(labels.map((label) => label.id === id ? { ...label, ...patch } : label));

export const moveTextLabel = (labels: GameTextLabel[], id: string, x: number, y: number): GameTextLabel[] =>
  updateTextLabel(labels, id, { x, y });

export const removeTextLabel = (labels: GameTextLabel[], id: string): GameTextLabel[] =>
  labels.filter((label) => label.id !== id);
