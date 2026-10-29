// Recover explicit older AI notation without inventing an index or bound.
// Kept pure and shared by server/client presentation hygiene.
export function normalizeLegacyNotation(source: string): string {
  return source
    .replace(/\\?\blim\s*\[\s*([A-Za-zα-ωΑ-Ω](?:_[A-Za-z0-9]+)?)\s*(?:→|->|\\to\s*)\s*([^\]\n]+?)\s*\]/g,
      (_all, variable: string, target: string) => `\\lim_{${variable}\\to ${target.trim()}}`)
    .replace(/(?:∑|\\sum)\s*\[\s*([A-Za-zα-ωΑ-Ω])\s*=\s*([^\]\n]+?)\s+to\s+([^\]\n]+?)\s*\]/gi,
      (_all, index: string, lower: string, upper: string) => `\\sum_{${index}=${lower.trim()}}^{${upper.trim()}}`);
}
