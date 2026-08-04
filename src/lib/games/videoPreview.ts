// Video Adventure Preview runtime.
//
// The engine now lives in `loopRuntime.ts` and is shared with live gameplay.
// This module stays as the Preview-facing entry point.

export {
  useLoopRuntime,
  useLoopRuntime as usePreviewRuntime,
  loopStateOf,
  loopRegionFor,
  visibleLoopElements,
  barName,
} from "./loopRuntime";
export type { LoopRuntime, LoopRuntime as PreviewRuntime, LoopState } from "./loopRuntime";
