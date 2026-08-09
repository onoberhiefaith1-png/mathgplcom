import SchoolShell from "@/components/accounts/SchoolShell";

/**
 * The School Administrative Workspace.
 *
 * It oversees the school: the actual teachers and students connected to it,
 * their individual school workspaces (view only), and the school-wide record.
 * There is no Teaching Hub here — authoring belongs to a teacher account.
 */
const SchoolDashboard = () => (
  <SchoolShell
    title="School Command Centre"
    subtitle="Oversee the teachers and students connected to this school. Open any person to observe their own school workspace — the school never creates accounts and never edits another account's work."
  >
    <section className="rounded-2xl border border-border bg-card/60 p-6">
      <h2 className="text-lg font-semibold">School Report</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        The School Report combines the academic records of this school&rsquo;s teachers and students into one picture of
        school performance. It is not one teacher&rsquo;s report and not one student&rsquo;s report.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/40 p-4 text-xs text-muted-foreground">
{`School Report
   ↓  All teachers
   ↓  Their classes
   ↓  All unique school students
   ↓  Individual performance`}
      </pre>
      <p className="mt-3 text-xs text-muted-foreground">
        A student in five classes is still one student in the school&rsquo;s unique student count.
      </p>
    </section>
  </SchoolShell>
);

export default SchoolDashboard;
