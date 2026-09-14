declare module "troika-three-text" {
  export interface TroikaTextRenderInfo {
    caretPositions: Float32Array;
    blockBounds: [number, number, number, number];
    visibleBounds: [number, number, number, number];
    caretHeight?: number;
  }

  export interface CaretHit {
    x: number;
    y: number;
    height: number;
    charIndex: number;
  }

  export interface SelectionRect {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  export function getCaretAtPoint(
    renderInfo: TroikaTextRenderInfo,
    x: number,
    y: number,
  ): CaretHit | null;

  export function getSelectionRects(
    renderInfo: TroikaTextRenderInfo,
    start: number,
    end: number,
  ): SelectionRect[] | null;
}
