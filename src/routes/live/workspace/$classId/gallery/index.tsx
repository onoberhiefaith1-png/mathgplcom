import { createFileRoute } from "@tanstack/react-router";
import ClassGalleryEditorPage from "@/pages/ClassGalleryEditorPage";

export const Route = createFileRoute("/live/workspace/$classId/gallery/")({
  component: ClassGalleryEditorPage,
});
