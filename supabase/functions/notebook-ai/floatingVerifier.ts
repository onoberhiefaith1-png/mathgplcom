// Hard verifier for floating-number chip lists. Single source of truth for
// the five laws. Used to gate every response returned by `notebook-ai`
// before it ever reaches the UI.

const ALLOWED_CONTAINERS = new Set([
  "fraction","bracket","radical","power","log","integral",
  "matrix","differential","abs","vector",
]);

const RAW_OP_CHIPS = new Set(["+", "−", "-", "×", "*", "·", "÷", "/"]);
const RAW_BRACKET_CHIPS = new Set(["(", ")", "[", "]", "{", "}"]);

const SHELL_CHIP_RE = /^[−+]?(□\/□|\(\)|\[\]|√(\[[^\]]+\])?\(\)|\(\)\^\(\)|\(\)\^[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]+|\(\)[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]+|log[₀₁₂₃₄₅₆₇₈₉_a-zA-Z0-9]*\(\)|log_[a-zA-Z0-9]+\(\)|\|\(\)\||d\/d[a-zA-Z]+\(\)|∫[^()]*\(\)d[a-zA-Z])$/;

/** Deep-scan for any arithmetic sign anywhere in the chip body, including
 *  inside nested (), [], {}. Leading sign on the whole chip is ignored —
 *  that's the chip's own sign. */
const hasAnyHiddenArithmetic = (src: string): boolean => {
  if (!src) return false;
  const s = src.replace(/\s+/g, "");
  for (let i = 0; i < s.length; i++) {
    if (i === 0) continue;
    const c = s[i];
    if (c === "+" || c === "-" || c === "−" || c === "–" ||
        c === "*" || c === "×" || c === "·" || c === "÷") return true;
  }
  return false;
};

const stripLeadingSign = (chip: string): string => {
  if (!chip) return chip;
  if (chip[0] === "+" || chip[0] === "−" || chip[0] === "-" || chip[0] === "×" || chip[0] === "÷") {
    return chip.slice(1);
  }
  return chip;
};

const isShellChip = (chip: string): boolean => SHELL_CHIP_RE.test(chip);

export interface VerifyFailure {
  code:
    | "NoRawOperatorChip"
    | "NoRawBracketChip"
    | "NoSyntheticLeadingPlus"
    | "NoHiddenSign"
    | "ContainerAllowed"
    | "ContainerDedup"
    | "EmptyChip";
  chip?: string;
  index?: number;
  detail?: string;
}

export interface VerifyResult {
  ok: boolean;
  failures: VerifyFailure[];
}

export const verifyLine = (line: { fillers: string[]; containers: string[] }): VerifyResult => {
  const failures: VerifyFailure[] = [];
  const fillers = Array.isArray(line.fillers) ? line.fillers : [];
  const containers = Array.isArray(line.containers) ? line.containers : [];

  // Containers: allowed kinds only, deduped.
  const seen = new Set<string>();
  for (const c of containers) {
    if (!ALLOWED_CONTAINERS.has(c)) {
      failures.push({ code: "ContainerAllowed", detail: c });
    } else if (seen.has(c)) {
      failures.push({ code: "ContainerDedup", detail: c });
    } else {
      seen.add(c);
    }
  }

  // Chip-level checks.
  let seenContent = false;
  for (let i = 0; i < fillers.length; i++) {
    const chip = String(fillers[i] ?? "");
    if (!chip) {
      failures.push({ code: "EmptyChip", index: i });
      continue;
    }
    if (RAW_OP_CHIPS.has(chip)) {
      // "=" and "±" are valid splitter chips; raw "+", "−", "×", "÷", "/", "*" are not.
      failures.push({ code: "NoRawOperatorChip", chip, index: i });
    }
    if (RAW_BRACKET_CHIPS.has(chip)) {
      failures.push({ code: "NoRawBracketChip", chip, index: i });
    }
    if (chip === "=" || chip === "±") {
      seenContent = false;
      continue;
    }
    const prev = i > 0 ? String(fillers[i - 1] ?? "") : "";
    const afterSplitter = prev === "=" || prev === "±";
    if ((!seenContent || afterSplitter) && chip[0] === "+") {
      failures.push({ code: "NoSyntheticLeadingPlus", chip, index: i });
    }
    // Hidden-sign check — skip if chip IS a recognized shell (shells are
    // empty placeholders and never carry interior arithmetic).
    const body = stripLeadingSign(chip);
    if (!isShellChip(chip) && hasAnyHiddenArithmetic(body)) {
      failures.push({ code: "NoHiddenSign", chip, index: i });
    }
    seenContent = true;
  }

  return { ok: failures.length === 0, failures };
};

export const verifyLines = (lines: Array<{ fillers: string[]; containers: string[] }>): VerifyResult => {
  const all: VerifyFailure[] = [];
  for (let i = 0; i < lines.length; i++) {
    const r = verifyLine(lines[i]);
    for (const f of r.failures) all.push({ ...f, detail: `line ${i}: ${f.detail ?? f.chip ?? ""}` });
  }
  return { ok: all.length === 0, failures: all };
};
