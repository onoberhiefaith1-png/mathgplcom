import { createFileRoute } from "@tanstack/react-router";
import StudentGalleryPage from "@/pages/student/StudentGalleryPage";

export const Route = createFileRoute("/student/class/$classId/gallery/")({
  component: StudentGalleryPage,
});
