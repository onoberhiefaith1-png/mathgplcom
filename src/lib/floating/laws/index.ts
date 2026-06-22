// Floating Number Law Engine — seed laws.
// Each law: detect() inspects the element stream and apply() emits chips +
// scaffolds + a human explanation. The engine runs all laws in order; the
// final chip list is the union of their outputs.
//
// This is intentionally a small seed (Visible Blade, Clean/Dirty Argument,
// Dictionary Gate, Fraction Scaffold, Function Gate). The teacher-approved
// laws in floating_law_library extend this list at runtime via the law
// discovery flow.

import type { MathElement } from "../elementDetector";

export interface LawTraceEntry {
  id: string;
  name: string;
  applies: boolean;
  reason: string;
  action?: string;
  result?: string;
}

export interface ScaffoldShell {
  kind: "fraction" | "bracket" | "radical" | "power" | "subscript" | "log" | "integral";
  label: string;
}

export interface LawEngineResult {
  chips: string[];
  scaffolds: ScaffoldShell[];
  trace: LawTraceEntry[];
}

const ACTIVE_OPS = new Set(["+", "−", "-", "=", "±", "≠", "≤", "≥", "<", ">"]);

const containsActiveOperator = (body: string): boolean => {
  if (!body) return false;
  // Look at the inner string, treating any unshielded +/-/= as active.
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (depth === 0 && ACTIVE_OPS.has(c)) return true;
  }
  return false;
};

const splitOnTopLevelAddSub = (body: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(" || c === "{" || c === "[") { depth++; buf += c; continue; }
    if (c === ")" || c === "}" || c === "]") { depth--; buf += c; continue; }
    if (depth === 0 && (c === "+" || c === "-" || c === "−") && buf.length > 0) {
      out.push(buf);
      buf = c === "-" || c === "−" ? "-" : "+";
      continue;
    }
    buf += c;
  }
  if (buf) out.push(buf);
  // First chip drops its synthetic leading +
  if (out.length && out[0].startsWith("+")) out[0] = out[0].slice(1);
  return out;
};

export const runLawPipeline = (
  original: string,
  elements: MathElement[],
): LawEngineResult => {
  const trace: LawTraceEntry[] = [];
  const chips: string[] = [];
  const scaffolds: ScaffoldShell[] = [];

  // We walk the element stream once. As we encounter compound structures
  // (fraction, radical, power, bracket-with-active-op, function-call) we
  // delegate to the matching law module below.

  for (let i = 0; i < elements.length; i++) {
    const e = elements[i];

    if (e.kind === "fraction") {
      // Law: Fraction Scaffold — every fraction is inherently dirty.
      const [num, den] = e.value.split("/");
      scaffolds.push({ kind: "fraction", label: "□/□" });
      const numParts = containsActiveOperator(num) ? splitOnTopLevelAddSub(num) : [num];
      const denParts = containsActiveOperator(den) ? splitOnTopLevelAddSub(den) : [den];
      chips.push("□/□", ...numParts, ...denParts);
      trace.push({
        id: "fraction-scaffold",
        name: "Fraction Scaffold",
        applies: true,
        reason: "Every fraction is inherently dirty (the bar is a division operator).",
        action: `Drop □/□ shell and isolate numerator (${num}) and denominator (${den}).`,
        result: ["□/□", ...numParts, ...denParts].join(" | "),
      });
      continue;
    }

    if (e.kind === "radical") {
      scaffolds.push({ kind: "radical", label: "√()" });
      const body = e.value.includes(":") ? e.value.split(":").pop()! : e.value;
      const parts = containsActiveOperator(body) ? splitOnTopLevelAddSub(body) : [body];
      chips.push("√()", ...parts);
      trace.push({
        id: "dirty-argument-radical",
        name: "Dirty Argument — Radical",
        applies: containsActiveOperator(body),
        reason: containsActiveOperator(body)
          ? "Radical body contains an active operator."
          : "Radical body is clean; we still emit the shell so it remains draggable.",
        action: `Drop √() shell and isolate the radicand ${body}.`,
        result: ["√()", ...parts].join(" | "),
      });
      continue;
    }

    if (e.kind === "power") {
      const body = e.value;
      if (containsActiveOperator(body)) {
        // Law 1 + Law 3 + Law 16.5 cascade
        scaffolds.push({ kind: "power", label: "()^()" });
        const parts = splitOnTopLevelAddSub(body);
        chips.push("()^()", ...parts);
        trace.push({
          id: "dirty-exponent-cascade",
          name: "Dirty Exponent Cascade",
          applies: true,
          reason: "Visible Blade detects an operator inside the exponent.",
          action: `Scaffold Isolation forces ()^( ) shell; extract ${body}.`,
          result: ["()^()", ...parts].join(" | "),
        });
      } else {
        // Clean exponent — fuse with previous chip if any.
        const tail = chips.pop() ?? "";
        chips.push(`${tail}^${body.length > 1 ? `(${body})` : body}`);
        trace.push({
          id: "clean-exponent",
          name: "Clean Exponent",
          applies: true,
          reason: "No operator inside exponent; it fuses to its base.",
          action: `Fuse ^${body} to ${tail}.`,
          result: `${tail}^${body}`,
        });
      }
      continue;
    }

    if (e.kind === "subscript") {
      const body = e.value;
      const tail = chips.pop() ?? "";
      if (containsActiveOperator(body)) {
        scaffolds.push({ kind: "subscript", label: "()_()" });
        const parts = splitOnTopLevelAddSub(body);
        chips.push(`${tail}_{}`, ...parts);
        trace.push({
          id: "dirty-subscript",
          name: "Dirty Subscript",
          applies: true,
          reason: "Subscript contains an active operator.",
          action: `Drop ${tail}_{} shell, extract ${body}.`,
          result: [`${tail}_{}`, ...parts].join(" | "),
        });
      } else {
        chips.push(`${tail}_${body}`);
        trace.push({
          id: "clean-subscript",
          name: "Clean Subscript",
          applies: true,
          reason: "Subscript is clean; fuse to base.",
          result: `${tail}_${body}`,
        });
      }
      continue;
    }

    if (e.kind === "function-name") {
      // Look ahead — does a bracket open right after?
      const nextOpen = elements[i + 1];
      if (nextOpen && nextOpen.kind === "bracket-open") {
        // Find matching close
        let depth = 1;
        let j = i + 2;
        const body: MathElement[] = [];
        while (j < elements.length && depth > 0) {
          if (elements[j].kind === "bracket-open") depth++;
          else if (elements[j].kind === "bracket-close") { depth--; if (depth === 0) break; }
          if (depth > 0) body.push(elements[j]);
          j++;
        }
        const bodyStr = body.map((b) => b.raw).join("");
        if (containsActiveOperator(bodyStr)) {
          scaffolds.push({ kind: "bracket", label: `${e.value}()` });
          const parts = splitOnTopLevelAddSub(bodyStr);
          chips.push(`${e.value}()`, ...parts);
          trace.push({
            id: "function-gate-dirty",
            name: "Function Gate — Dirty Argument",
            applies: true,
            reason: `${e.value}(…) has an active operator inside.`,
            action: `Drop ${e.value}() shell; extract ${bodyStr}.`,
            result: [`${e.value}()`, ...parts].join(" | "),
          });
        } else {
          chips.push(`${e.value}(${bodyStr})`);
          trace.push({
            id: "function-gate-clean",
            name: "Function Gate — Clean Argument",
            applies: true,
            reason: `${e.value}(…) is clean; fuse as a single function chip.`,
            result: `${e.value}(${bodyStr})`,
          });
        }
        i = j;
        continue;
      }
      chips.push(e.value);
      continue;
    }

    if (e.kind === "bracket-open") {
      // Generic bracket (not preceded by a function name). Find body, decide
      // clean vs dirty.
      let depth = 1;
      let j = i + 1;
      const body: MathElement[] = [];
      while (j < elements.length && depth > 0) {
        if (elements[j].kind === "bracket-open") depth++;
        else if (elements[j].kind === "bracket-close") { depth--; if (depth === 0) break; }
        if (depth > 0) body.push(elements[j]);
        j++;
      }
      const bodyStr = body.map((b) => b.raw).join("");
      const prev = chips[chips.length - 1] ?? "";
      const isFunction = /^[a-zA-Z][a-zA-Z0-9]*$/.test(prev);
      if (containsActiveOperator(bodyStr)) {
        scaffolds.push({ kind: "bracket", label: "()" });
        const parts = splitOnTopLevelAddSub(bodyStr);
        chips.push("()", ...parts);
        trace.push({
          id: "dirty-bracket",
          name: "Dirty Argument — Bracket",
          applies: true,
          reason: "Bracket contains an active operator.",
          action: `Drop () shell, extract ${bodyStr}.`,
          result: ["()", ...parts].join(" | "),
        });
      } else if (isFunction) {
        const tail = chips.pop() ?? "";
        chips.push(`${tail}(${bodyStr})`);
        trace.push({
          id: "function-gate-clean",
          name: "Function Gate — Clean Argument",
          applies: true,
          reason: `${tail}(…) is clean; fuse as a single function chip.`,
          result: `${tail}(${bodyStr})`,
        });
      } else {
        chips.push(`(${bodyStr})`);
      }
        scaffolds.push({ kind: "bracket", label: "()" });
        const parts = splitOnTopLevelAddSub(bodyStr);
        chips.push("()", ...parts);
        trace.push({
          id: "dirty-bracket",
          name: "Dirty Argument — Bracket",
          applies: true,
          reason: "Bracket contains an active operator.",
          action: `Drop () shell, extract ${bodyStr}.`,
          result: ["()", ...parts].join(" | "),
        });
      } else if (isFunction) {
        const tail = chips.pop() ?? "";
        chips.push(`${tail}(${bodyStr})`);
      } else {
        chips.push(`(${bodyStr})`);
      }
      i = j;
      continue;
    }

    if (e.kind === "operator" || e.kind === "equality") {
      // Visible Blade — split chip stream around top-level operators by
      // attaching the operator to the next chip if appropriate.
      if (e.value === "=" || e.value === "±" || e.value === "≠" || e.value === "≤" || e.value === "≥") {
        chips.push(e.value);
      } else if (chips.length === 0) {
        chips.push(e.value); // leading sign
      } else {
        // attach to upcoming number/variable as a leading sign
        chips.push(e.value);
      }
      continue;
    }

    if (e.kind === "number" || e.kind === "variable") {
      // If the previous chip is a bare operator (+/-/×/÷), fuse it onto this chip.
      const prev = chips[chips.length - 1];
      if (prev && /^[+\-−×÷·]$/.test(prev)) {
        chips[chips.length - 1] = `${prev}${e.value}`;
      } else {
        chips.push(e.value);
      }
      continue;
    }

    if (e.kind === "text") {
      chips.push(e.value);
      continue;
    }

    if (e.kind === "integral") { chips.push("∫"); scaffolds.push({ kind: "integral", label: "∫" }); continue; }
    if (e.kind === "summation") { chips.push("∑"); continue; }
  }

  // Final cleanup: drop a synthetic leading "+" on the first chip (or first
  // chip after an = / ±).
  for (let i = 0; i < chips.length; i++) {
    const prev = i > 0 ? chips[i - 1] : "";
    const afterSplit = i === 0 || prev === "=" || prev === "±";
    if (afterSplit && chips[i].startsWith("+")) chips[i] = chips[i].slice(1);
  }

  if (trace.length === 0) {
    trace.push({
      id: "atom-only",
      name: "Atom Only",
      applies: true,
      reason: "No compound structures detected; each atom becomes its own chip.",
      result: chips.join(" | "),
    });
  }

  return { chips, scaffolds, trace };
};
