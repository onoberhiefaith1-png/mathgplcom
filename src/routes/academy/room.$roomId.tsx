import { createFileRoute } from "@tanstack/react-router";
import AcademyRoomPage from "@/pages/academy/AcademyRoomPage";

export const Route = createFileRoute("/academy/room/$roomId")({
  head: () => ({
    meta: [
      { title: "Academy room — MathGPL" },
      { name: "description", content: "Explore a room inside the MathGPL Academy." },
      { property: "og:title", content: "Academy room — MathGPL" },
      { property: "og:description", content: "Rooms, sections and shelves inside the MathGPL Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyRoomPage,
});