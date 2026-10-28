export function clampCharacterScale(value: number) {
  return Math.min(10, Math.max(0.3, Number.isFinite(value) ? value : 1));
}

/** Match original Flow geometry: free fractional centre and width-based size, no snapping or shrinking. */
export function characterPlacement(width: number, _height: number, position: { x: number; y: number; scale: number }) {
  const scale = clampCharacterScale(position.scale);
  const characterWidth = width * 0.2 * scale;
  const characterHeight = characterWidth * 4 / 3;
  return { x: width * position.x / 100 - characterWidth / 2, y: _height * position.y / 100 - characterHeight / 2, width: characterWidth, height: characterHeight };
}
