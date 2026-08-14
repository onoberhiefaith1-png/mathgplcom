import { createFileRoute } from "@tanstack/react-router";
import StudentLessonNotesPage from "@/pages/student/StudentLessonNotesPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/lesson-notes/")({
  component: () => <StudentFeatureGate item="class_notes" Page={StudentLessonNotesPage} />,
});
