import { createFileRoute } from "@tanstack/react-router";
import TeacherManagementPanel from "@/components/accounts/TeacherManagementPanel";
import RoleShell from "@/components/accounts/RoleShell";

export const Route = createFileRoute("/family/teachers/")({
  head: () => ({
    meta: [
      { title: "Connected teachers — Mathemagine Family" },
      { name: "description", content: "Connect the teachers who teach your children and manage those connections." },
      { property: "og:title", content: "Connected teachers — Mathemagine Family" },
      { property: "og:description", content: "Connect the teachers who teach your children and manage those connections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleShell title="Account">
      <TeacherManagementPanel mode="parent" />
    </RoleShell>
  ),
});
