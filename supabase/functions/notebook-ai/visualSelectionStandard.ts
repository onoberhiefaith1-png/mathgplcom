// INTELLIGENT VISUAL SELECTION — Physics add-on. Chooses the right kind of
// visual for each teaching moment. Never edits the Maths diagram standards.

export type VisualKind = "diagram" | "photo" | "illustration" | "graph";

/** Deterministic default for what a visual request is about. */
export function chooseVisualKind(need: string): VisualKind {
  const s = need.toLowerCase();
  if (/graph|against time|v-t|s-t|distance-time|velocity-time|plot|data|results|curve/.test(s)) return "graph";
  if (/circuit|free[- ]body|force diagram|ray|lens|mirror|field line|wave diagram|vector|resolution|atom|nucleus|labelled/.test(s)) return "diagram";
  if (/real|photo|instrument|vernier|micrometer|caliper|apparatus|meter|thermometer|equipment/.test(s)) return "photo";
  return "illustration";
}

export const VISUAL_SELECTION_STANDARD = `
VISUAL SELECTION (Physics)
Choose the visual that best helps students understand; no unnecessary pictures,
and never text-only where a visual is substantially better.
1. TECHNICAL DIAGRAM — structure, labels, directions, connections: circuits
   (every component on a closed loop, correctly connected), free-body diagrams
   (arrows from the body, correct direction, labelled), ray diagrams, labelled
   apparatus, wave and field-line diagrams. Build these with the native diagram
   engine; accuracy beats decoration.
2. REAL PHOTOGRAPH — when students must see an actual instrument, material or
   phenomenon (vernier caliper, micrometer screw gauge, lab equipment).
3. AI EDUCATIONAL ILLUSTRATION — realistic context or a scene that cannot easily
   be photographed (everyday application, a hazard scenario). Must never
   contradict the Physics.
4. GRAPH — motion graphs, experimental data, relationships; use native graphs
   with labelled axes and units.
Each visual gets a caption and is referred to in the text.
`.trim();
