/** Geometry is shared by preview and player; character never overlaps actions. */
export function completionLayout(width: number, height: number, scale = 1) {
  const compact = width < 768;
  const footerHeight = Math.min(compact ? 156 : 230, Math.max(86, height * 0.29));
  const characterHeight = Math.min(footerHeight - 8, (compact ? 148 : 220) * Math.min(1.5, Math.max(0.5, scale)));
  const characterWidth = Math.min(width * 0.34, characterHeight * 0.75);
  return { footerHeight, characterHeight, characterWidth, reactionWidth: Math.max(80, width - characterWidth - 32) };
}