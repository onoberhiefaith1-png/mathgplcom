// WORKSPACE STANDARD — the AI Generator is an orchestrator of the platform's
// real tools, not a plain-text generator.
//
// The client sends a live manifest of every workspace tool + Asset Library
// entry (see src/lib/lessonnotes/ai/toolManifest.ts). Whatever tools exist in
// the app at that moment are automatically available here, so new tools need
// no change to this file.

export const WORKSPACE_STANDARD = `
WORKSPACE ORCHESTRATION (mandatory)

You are writing inside a mathematics authoring environment that already owns
specialised tools. Before producing ANY content you must ask:
"Is there a platform tool that does this better than typed text?"

Decision order, always:
  1. Asset Library  — reuse an existing object if one matches.
  2. Smart Table    — every table of any kind.
  3. Graph          — every plot, curve, coordinate or data chart.
  4. Diagram / 3D   — every shape, angle, solid, net or geometric figure.
  5. Calculator     — every worked numeric/symbolic calculation object.
  6. Structures     — fractions, roots, powers, matrices.
  7. Plain text     — ONLY when nothing above fits (explanations, definitions,
                      teaching prose, step lines).

To use a tool, emit a directive ON ITS OWN LINE:
  [[tool:<id> key="value" key="value"]]

Rules for directives:
  • Never draw a table, chart, shape or solid with characters, dashes, pipes,
    ASCII art or markdown — emit the directive instead.
  • Keep normal teaching prose as normal text around the directives.
  • Only use tool ids from the manifest. Never invent an id.
  • Directives are replaced by real editable objects; do not describe them
    ("the table below shows…" is fine, "|x|f|" is not).
  • If no tool fits, just write the text. Never emit an empty directive.
`.trim();

/** Wrap the client-supplied manifest for the prompt. */
export function workspaceManifestBlock(manifest?: string): string {
  if (!manifest || !manifest.trim()) return "";
  return `AVAILABLE WORKSPACE TOOLS (live manifest from the teacher's editor):\n${manifest.trim()}`;
}

const ASCII_TABLE = /^\s*\|?[^\n]*\|[^\n]*\|/m;
const ASCII_ART = /^[ \t]*[+\-_=*/\\|]{6,}[ \t]*$/m;

/**
 * Detect content that a workspace tool should have produced. Returns a list of
 * problems; empty list = compliant.
 */
export function workspaceViolations(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  const withoutDirectives = text.replace(/\[\[tool:[^\]]*\]\]/g, "");
  if (ASCII_TABLE.test(withoutDirectives)) {
    out.push("A table was typed by hand. Use [[tool:smartTable …]] instead.");
  }
  if (ASCII_ART.test(withoutDirectives)) {
    out.push("A figure was drawn with characters. Use [[tool:diagram …]] or [[tool:solid3d …]] instead.");
  }
  if (/\b(sketch|draw|plot)\s+(the\s+)?(graph|curve)\b/i.test(withoutDirectives) &&
      !/\[\[tool:graph/.test(text)) {
    out.push("A graph was described in words. Use [[tool:graph …]] instead.");
  }
  return out;
}

export function workspaceCorrection(violations: string[]): string {
  return [
    "Your output ignored the workspace tools.",
    ...violations.map((v) => `• ${v}`),
    "Rewrite the SAME content, replacing every hand-made object with the correct [[tool:…]] directive. Keep all mathematics identical.",
  ].join("\n");
}
