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
  1. Asset Library  — ONLY non-mathematical assets (symbols, structures,
                      illustrations). Never a mathematical diagram.
  2. Smart Table    — every table of any kind.
  3. Graph          — every plot, curve, coordinate or data chart.
  4. Diagram Engine — every Venn, tree, flowchart, shape, angle, circle part,
                      solid or net, CONSTRUCTED from its meaning with
                      [[tool:diagram type=…]] (see MATHEMATICAL DIAGRAM ENGINE).
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

RECONSTRUCTION LAW (diagrams, tables, graphs, matrices, maths — typed, pasted
or shown in a picture):
  • The QUESTION / lesson text is the source of truth. A sketch, screenshot or
    copied layout is only supporting evidence. Rebuild what the content MEANS;
    do not copy scattered positions, rough handwriting, red markup or bad
    formatting.
  • Rebuild the STRUCTURE as the native object. Never describe a picture and
    never insert it as an image.
  • Geometry → [[tool:geometry …]] with every labelled point, segment, angle,
    measurement and relationship stated by the question or visible in the
    sketch ("AB is parallel to CD" ⇒ parallel="AB CD"). If the question says
    "two parallel lines crossed by a transversal", create a clean parallel-
    transversal diagram even when the source sketch is missing or messy.
  • Preserve mathematical relationships above visual similarity: parallel lines
    must actually be parallel, perpendicular lines perpendicular, labels attached
    to their objects, measurements attached to the correct side/angle/circle.
  • Use the question text to decide what the figure must show, but NEVER
    invent a value that is neither visible nor stated. Put anything you could
    not determine in unclear="…" and lower the confidence.
  • Tables → smartTable with every header and cell; graphs → graph with the
    equation and ranges; matrices → structure kind="matrix"; sets/Venn → use
    the Venn/diagram asset when a native set diagram is needed.
  • Complete pasted lessons must be reconstructed section-by-section: headings,
    questions, one solution micro-step per line, and native objects where the
    content requires them. Never preserve corrupt copied layout as the final
    lesson structure.

SMART STRUCTURE LAW (long division, prime-factorisation / division ladder,
base conversion, place-value chart, column addition, long multiplication):
  • These layouts are STATIC STRUCTURES the teacher designed. Never redraw,
    rebuild or re-typeset them, and never approximate them with text, dashes
    or spaces.
  • Reuse the existing structure asset and only supply the values that belong
    in its editable cells (digits, quotients, remainders, partial products).
  • Structural parts — the division bracket, horizontal rules, minus signs,
    the ladder divider, the "R" remainder labels, column separators — belong
    to the structure and must never be emitted as content.
`.trim();

export const DIAGRAM_ENGINE_STANDARD = `
MATHEMATICAL DIAGRAM ENGINE (mandatory)

Think: "I don't need a picture of the object. I understand the object, so I
construct it." Mathematical diagrams are NEVER picked from the Asset Library
(no asset="venn2", asset="triangleIso", asset="cube"). Always write the data:

Venn — understand sets → relationships → regions → values/shading:
  [[tool:diagram type="venn" sets="Mathematics,Science" total="40" A="25" B="18" AB="10" stage="solution"]]
  The engine calculates A only = 15, both = 10, B only = 8, neither = 7.
  Or give regions directly: regions="A:15,AB:10,B:8,:7" (empty key = outside).
  Operations: shade="A∩B" | "A∪B" | "A'" | "A-B"; relation="disjoint" for
  non-overlapping sets; three sets: sets="A,B,C" regions="A:…,AB:…,ABC:…".
  Mathematical write-up: write="A_only:15;AB_only:7;A∩B:8;A∪B:35;A∩B∩C:4;U:50".
  These are DIFFERENT concepts, never interchangeable: "A only" (one region),
  "A∩B only" (overlap excluding C), "A∩B" (overlap incl. centre in 3 sets),
  "A∪B" (whole union — never put its value in the overlap), "A∩B∩C" (centre),
  "U" (universal set). A/B/C are set positions; labels come from sets=.
  To edit an existing Venn ("put 8 in the Maths and Science intersection",
  "rename Mathematics to English"), re-emit the same directive with the
  updated sets=/write= values — never redraw it as a picture.
  Teaching focus is semantic, never an arbitrary colour edit. Use
  focus="A_only" | "A∩B" | "AB_only" | "A∪B" | "A'" | "A∩B∩C" to show
  the exact mathematical regions while preserving set identity colours.
  "Return to normal colours" means focus="clear". Resolve teacher-facing set
  names through the order in sets= (first=A, second=B, third=C).
Tree — understand events → branches → outcomes:
  [[tool:diagram type="tree" stages="H,T;H,T" probs="1/2,1/2;1/2,1/2" stage="solution"]]
Flowchart — understand actions and decisions:
  [[tool:diagram type="flowchart" steps="Start; Input n; ?Is n ÷ 2 a whole number?|Print Even|Print Odd; End"]]
Geometry — understand the properties first (equal sides, parallel, tangent,
  radius 5 cm with diameter marked), then [[tool:geometry …]] or [[tool:diagram type="circle" …]].
3D — [[tool:solid3d kind="cuboid" length="8" width="5" height="3"]].

Intent: overlapping groups / "both" / "neither" → Venn; outcomes of repeated
events → tree; a process or algorithm → flowchart.

Question vs Solution: the question section carries stage="question" (structure
and labels; values the student must find are left blank). The matching Solution
section carries the SAME diagram with stage="solution" and every value the
worked solution calculated. Diagram values must agree with the solution lines.
`.trim();

export const EDUCATIONAL_RECONSTRUCTION_STANDARD = `
AI EDUCATIONAL DRAWING & RECONSTRUCTION ENGINE

Core pipeline:
Raw draft / selected content / screenshot
→ content understanding
→ educational intent
→ mathematical/data relationships
→ structured native-object plan
→ Solmagine directives
→ validation against the original content.

Rules:
1. Content determines structure. Ask: "What should a teacher and student see
   here to understand the lesson?" not "What did the copied page look like?"
2. The question is primary evidence. The sketch supports it; it does not control
   the final layout when the sketch is messy, incomplete or copied badly.
3. If the content describes an object clearly, create the native object even
   when no usable sketch exists.
4. If essential information is missing, create only the known structure and mark
   the missing fact in unclear="…" with confidence="medium" or "low". Never make
   up a measurement, label or relationship.
5. Output directives on their own lines. Do not output screenshots, SVG, base64,
   markdown tables, ASCII art or prose descriptions in place of a native object.
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
  if (
    /\b(parallel|perpendicular|transversal|intersecting lines|angle\s+[a-z]|triangle|circle|chord|tangent|diameter|radius|semicircle|polygon)\b/i.test(withoutDirectives) &&
    /\b(diagram|sketch|draw|shown|figure|find\s+[a-z]|angle|line)\b/i.test(withoutDirectives) &&
    !/\[\[tool:(geometry|diagram)/.test(text)
  ) {
    out.push("A geometry figure was described or copied as text. Use [[tool:geometry …]] or a native diagram directive instead.");
  }
  if (/\[\[tool:(diagram|asset)[^\]]*\b(asset|query)="?(venn|tree|flow|triangle|circle|square|rectangle|cube|cuboid|cylinder|cone|sphere|line|angle|parallel|polygon)/i.test(text)) {
    out.push("A mathematical diagram was requested from the Asset Library. Construct it with [[tool:diagram type=…]] and its mathematical data instead.");
  }
  if (/\b(venn diagram|tree diagram|flow ?chart)\b/i.test(withoutDirectives) && !/\[\[tool:diagram/.test(text)) {
    out.push("A Venn, tree or flowchart was mentioned but not constructed. Emit [[tool:diagram type=…]] with its data.");
  }
  if (/\[\s*[-+]?\d[^\n\]]+\]\s*\n\s*\[\s*[-+]?\d/i.test(withoutDirectives) && !/\[\[tool:structure[^\]]*kind="matrix"/.test(text)) {
    out.push("A matrix was typed as rows of text. Use [[tool:structure kind=\"matrix\" …]] instead.");
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
