import character from "@/assets/game-fallback-character.png";
import { offlineMediaUrl } from "@/lib/offline/prepareOffline";

export const DEFAULT_GAME_EMOTIONS = [
  { id: "happy", label: "😊" }, { id: "surprised", label: "😮" },
  { id: "laugh", label: "😄" }, { id: "love", label: "😍" }, { id: "celebrate", label: "🥳" },
];

/** Bundled image and CSS reactions require no account, fetch, video or AI. */
export function FallbackGameCharacter({ reaction, reactionKey, offline = false }: { reaction: string | null; reactionKey: number; offline?: boolean }) {
  return <div className="game-fallback-character relative h-full w-full" data-reaction={reaction ?? "idle"}>
    <img key={reactionKey} src={offline ? offlineMediaUrl(character) : character} alt="MathGPL character" width={672} height={992} className={`h-full w-full object-contain ${reaction ? "game-character-react" : ""}`} />
    {reaction ? <span key={`reaction-${reactionKey}`} className="game-character-emotion absolute right-0 top-0 text-3xl" aria-live="polite">{reaction}</span> : null}
  </div>;
}