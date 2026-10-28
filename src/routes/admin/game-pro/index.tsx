import { createFileRoute } from "@tanstack/react-router";
import GameSlateGalleryPage from "@/pages/game/GameSlateGalleryPage";

// Game Pro: the archived 3D Game, kept for admin reference only.
export const Route = createFileRoute("/admin/game-pro/")({
  head: () => ({ meta: [{ title: "Game Pro (Archived) | MathGPL Admin" }, { name: "robots", content: "noindex" }] }),
  component: GameSlateGalleryPage,
});
