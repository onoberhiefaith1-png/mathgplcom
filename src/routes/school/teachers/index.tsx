import { createFileRoute } from "@tanstack/react-router";
import TeacherManagementPanel from "@/components/accounts/TeacherManagementPanel";
import RoleShell from "@/components/accounts/RoleShell";
import CommunityTeacherSearch from "@/components/accounts/CommunityTeacherSearch";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

const SchoolTeachers = () => {
  const { active } = useWorkspace();
  return (
    <RoleShell title="Account">
      <div className="space-y-6">
        <TeacherManagementPanel mode="school" />
        <CommunityTeacherSearch orgId={active?.kind === "school" ? active.orgId : null} />
      </div>
    </RoleShell>
  );
};

export const Route = createFileRoute("/school/teachers/")({
  head: () => ({
    meta: [
      { title: "Teacher management — MathGPL School" },
      { name: "description", content: "Add, invite, suspend and remove the teachers in your school. Each teacher owns an independent workspace." },
      { property: "og:title", content: "Teacher management — MathGPL School" },
      { property: "og:description", content: "Add, invite, suspend and remove the teachers in your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchoolTeachers,
});
