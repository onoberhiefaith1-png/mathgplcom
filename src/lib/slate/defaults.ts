import { defaultConversion } from "./conversion";
import { defaultSoundSettings } from "./sound";
import type { AssetSettings, Game, GameSettings, GameStatus, NumberSettings, Slot } from "./types";
import { defaultScene } from "./environments";
import { NO_ROOM_ID } from "./rooms";
import { defaultTextSettings } from "./text3d";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Record id for a saved game (stored in the account, so it must be a UUID). */
export const gameUid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${uid()}${uid()}-${uid().slice(0, 4)}-4${uid().slice(0, 3)}-8${uid().slice(0, 3)}-${uid()}${uid()}`;

export const defaultNumberSettings = (): NumberSettings => ({
  visible: true,
  colour: null,
  opacity: 0.6,
  size: 1,
  depth: 1,
  bevel: 1,
  shadow: 1,
  contrast: 1,
  align: "left",
  vertical: "top",
  relief: "auto",
  swatches: [],
});

export const defaultAssetSettings = (): AssetSettings => ({
  sun: null,
  audio: [],
  activeTrackId: null,
  roomTrackIds: {},
});

export const defaultSettings = (): GameSettings => ({
  slate: { scale: 1, width: 860, slotSpacing: 22, slotMinHeight: 96, slotPadding: 22 },
  // Keep existing Games on the current raised/3D presentation until the teacher changes it.
  testDisplay: "threeD",
  text: defaultTextSettings(),
  numbers: defaultNumberSettings(),
  writing: {
    size: 30,
    depth: 1,
    bevel: 1,
    shadow: 1,
    highlight: 1,
    opacity: 1,
    style: "material",
  },
  rewards: { visible: true, opacity: 0.45, glow: 0.35, scale: 1 },
  effects: {
    speed: 1,
    glow: 1,
    particles: 1,
    duration: 3.5,
    testMode: true,
    premiumBombStyle: "radiant-chain",
  },
  assets: defaultAssetSettings(),
  // Filled from the attached Floating Numbers exercise, keyed by line id.
  lines: {},
  // One Life gives back one complete Game/question time by default.
  life: { multiplier: 1 },
  // Reward Conversion: Hourglass/Life 1×, Vault and Completion Coin 0.1×.
  conversion: defaultConversion(),
  // Game Sound: silent until the teacher chooses sounds.
  sound: defaultSoundSettings(),
});

export const defaultGameStatus = (): GameStatus => ({
  vaultsOpened: 0,
  lives: 3,
  timerEndsAt: null,
});

export const makeSlot = (index = 0): Slot => ({
  id: uid(),
  text: "",
  hiddenContent: "",
  contentState: "hidden",
  rewards: [],
  scene: defaultScene(index),
});

export const makeGame = (input: {
  name: string;
  topic: string;
  subtopic: string;
  surfaceId: string;
  lines: number;
  background: Game["background"];
  roomId?: string;
  /** MathGPL: Game Lines the repeating reward pattern covers. */
  patternLength?: number;
}): Game => ({
  // The game itself is stored in the account, so its id must be a real record id.
  id: gameUid(),
  name: input.name.trim() || "Untitled Game",
  topic: input.topic.trim(),
  subtopic: input.subtopic.trim(),
  surfaceId: input.surfaceId,
  surfaceColour: "#f4ead7",
  roomId: input.roomId ?? NO_ROOM_ID,
  background: input.background,
  slots: Array.from({ length: Math.max(1, input.lines) }, (_, index) => makeSlot(index)),
  settings: defaultSettings(),
  status: defaultGameStatus(),
  patternLength:
    Number(input.patternLength) > 0
      ? Math.floor(Number(input.patternLength))
      : Math.max(1, input.lines),
  updatedAt: Date.now(),
});
