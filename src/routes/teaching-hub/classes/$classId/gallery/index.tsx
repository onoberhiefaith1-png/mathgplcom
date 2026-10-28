import { createFileRoute } from "@tanstack/react-router";
import ClassGalleryEditorPage from "@/pages/ClassGalleryEditorPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/gallery/")({
  component: ClassGalleryEditorPage,
});
