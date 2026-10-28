// Strict Roman numeral parser/validator.
// Accepts only canonical forms (e.g. IV not IIII, XL not XXXX, no IL/IC).

const VALUES: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

/** Convert an integer (1–3999) to canonical Roman numeral. */
export function toRoman(n: number): string {
  if (n <= 0 || n >= 4000 || !Number.isInteger(n)) return "";
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [val, sym] of map) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

/** Parse a Roman numeral string strictly. Returns null if invalid. */
export function parseRoman(s: string): number | null {
  if (!s) return null;
  const str = s.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(str)) return null;
  // Round-trip: only accept canonical form.
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = VALUES[str[i]];
    const next = VALUES[str[i + 1]];
    if (next && next > cur) total -= cur;
    else total += cur;
  }
  if (total <= 0 || total >= 4000) return null;
  if (toRoman(total) !== str) return null;
  return total;
}

export function isValidRoman(s: string): boolean {
  return parseRoman(s) !== null;
}

/** Whether appending `sym` to `current` could still lead to a valid Roman numeral.
 *  Used to gate input buttons. Permissive — final check is parseRoman on submit. */
export function canAppend(current: string, sym: string): boolean {
  if (!"IVXLCDM".includes(sym)) return false;
  const candidate = current + sym;
  // Reject more than 3 consecutive identical I/X/C/M.
  if (/(.)\1{3,}/.test(candidate)) return false;
  // V, L, D may not repeat at all.
  if (/V.*V|L.*L|D.*D/.test(candidate)) return false;
  return true;
}
