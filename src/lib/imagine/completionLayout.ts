/**
 * Result-screen geometry shared by preview and player. Wide screens give the
 * character its own right-hand column beside the card; narrow screens put a
 * small character in the footer corner. The card never sits under the character.
 */
export function completionLayout(width: number, height: number, _scale = 1) {
  const compact = width < 768;
  const dense = height < 640 || compact;
  if (compact) {
    const footerHeight = Math.min(132, Math.max(80, height * 0.24));
    const characterHeight = footerHeight - 8;
    const characterWidth = Math.min(width * 0.3, characterHeight * 0.75);
    return { compact, dense, footerHeight, characterHeight, characterWidth, sideWidth: 0, reactionWidth: Math.max(80, width - characterWidth - 32) };
  }
  const characterWidth = Math.min(width * 0.22, (height - 24) * 0.75);
  const characterHeight = characterWidth * 4 / 3;
  const sideWidth = characterWidth + 24;
  const footerHeight = 64;
  return { compact, dense, footerHeight, characterHeight, characterWidth, sideWidth, reactionWidth: Math.max(80, width - sideWidth - 32) };
}

export type CompletionLayout = ReturnType<typeof completionLayout>;
