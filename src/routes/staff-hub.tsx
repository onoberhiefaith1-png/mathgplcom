import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import RequireAuth from "@/components/auth/RequireAuth";
import StaffHubPage from "@/pages/staffHub/StaffHubPage";

const search = z.object({
  tab: z.enum(["overview", "tasks", "team", "availability", "projects", "reports", "activity"]).optional(),
  task: z.string().optional(),
});

export const Route = createFileRoute("/staff-hub")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Staff Hub — MathGPL" },
      { name: "description", content: "Assign school tasks to teachers, review proof, track availability and staff performance." },
      { property: "og:title", content: "Staff Hub — MathGPL" },
      { property: "og:description", content: "The school's space for assigning, delivering and reviewing staff work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <StaffHubPage />
    </RequireAuth>
  ),
});
