import { createFileRoute } from "@tanstack/react-router";
import StudentGalleryPage from "@/pages/student/StudentGalleryPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/gallery/")({
  component: () => <StudentFeatureGate item="gallery" Page={StudentGalleryPage} />,
});
