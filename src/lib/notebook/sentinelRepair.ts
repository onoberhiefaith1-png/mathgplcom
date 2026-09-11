// SENTINEL REPAIR — never let a protection marker become classroom text.
//
// The LaTeX → classroom-math converters lift structures (empty power slots,
// held superscripts/subscripts, fractions, roots) out behind sentinel tokens
// and put them back at the end. An older backend build used sentinels whose
// PAYLOAD WAS ASCII ("\uE000POWER_SLOT\uE000", "\uE001SCRIPT_0\uE001").
// Any pass that dropped private-use characters — or turned `_S` into a
// subscript — left the readable payload behind, so a power stored as
// `x^{□}` came out as the nonsense token `xPOWERSCRIPT₀LOT`.
//
// Result on the board: the power silently disappeared (there was no `^`
// left to mirror). The same leak can hit subscripts, root indices and any
// other held script, because they all travel through the SCRIPT sentinel.
//
// This module repairs that residue back into a real, writable script slot,
// and scrubs every private-use remnant, so no marker can ever be displayed.

/** Any private-use sentinel character used by the converters. */
const PUA = /[\uE000-\uE3FF]/g;

/** Legacy empty-power sentinel, in every mangled form observed:
 *  `POWER_SLOT`, `POWERSLOT`, `POWERSCRIPT₀LOT`, with or without PUA wrap. */
const LEGACY_POWER_SLOT =
  /[\uE000-\uE3FF]?POWER[_\s]*(?:[\uE000-\uE3FF]?SCRIPT[_\s]*[0-9\u2080-\u2089\u2070-\u2079]*[\uE000-\uE3FF]?)?[_\s]*S?LOT[\uE000-\uE3FF]?/g;

/** Legacy held-script sentinel: `SCRIPT_3`, `SCRIPT₃`, PUA-wrapped or bare. */
const LEGACY_SCRIPT =
  /[\uE000-\uE3FF]?SCRIPT[_\s]*[0-9\u2080-\u2089\u2070-\u2079]+[\uE000-\uE3FF]?/g;

/**
 * Repair leaked converter sentinels in stored lesson-note text / floating
 * chips. An empty power slot is restored exactly; a held script whose payload
 * is unrecoverable becomes an empty writable exponent box — a real power the
 * teacher can complete, never readable debug text.
 */
export function repairLeakedSentinels(input: string): string {
  if (!input) return "";
  let s = String(input);
  if (!/POWER|SCRIPT|[\uE000-\uE3FF]/.test(s)) return s;
  s = s.replace(LEGACY_POWER_SLOT, "^{□}");
  s = s.replace(LEGACY_SCRIPT, "^{□}");
  // Defence in depth: a half-eaten sentinel must never reach the DOM.
  s = s.replace(PUA, "");
  return s;
}

/** True when the text still carries converter residue (diagnostics/tests). */
export function hasLeakedSentinel(input: string): boolean {
  if (!input) return false;
  return LEGACY_POWER_SLOT.test(input) || LEGACY_SCRIPT.test(input) || PUA.test(input);
}
