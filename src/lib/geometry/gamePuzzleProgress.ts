import { createContext } from "react";

/** Reports completion to the current Game attempt without changing equation marks. */
export const GamePuzzleProgress = createContext<{ attempt: string; complete: (objectId: string) => void } | null>(null);
