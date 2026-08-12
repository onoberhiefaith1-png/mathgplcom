import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import JoinClassPanel from "@/components/class/JoinClassPanel";

/**
 * Join Class, reached from the dashboard rather than being the front door. The
 * panel itself is the existing one — the behaviour is unchanged.
 */
const StudentJoinClassPage = () => (
  <WorkspaceLayout title="Join a class" subtitle="Use the code from your teacher">
    <p className="text-sm text-muted-foreground">
      Enter the join code your teacher gave you. The class then appears in My Classes.
    </p>
    <JoinClassPanel />
  </WorkspaceLayout>
);

export default StudentJoinClassPage;
