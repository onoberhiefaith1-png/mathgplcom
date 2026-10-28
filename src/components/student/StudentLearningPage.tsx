import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote } from "@/components/workspace/DashboardParts";

/**
 * One shell for the student's global learning pages: assignments, adventures
 * and Courses across every class. Read and play only — these pages never
 * offer a way to create or change a teacher's content.
 */
const StudentLearningPage = ({
  title,
  subtitle,
  blurb,
  loading,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  blurb: string;
  loading: boolean;
  empty: string;
  children: ReactNode;
  }) => (
  <WorkspaceLayout title={title} subtitle={subtitle}>
    <p className="text-sm text-muted-foreground">{blurb}</p>
    {loading ? (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    ) : (
      (children ?? <EmptyNote>{empty}</EmptyNote>)
    )}
  </WorkspaceLayout>
);

export default StudentLearningPage;
