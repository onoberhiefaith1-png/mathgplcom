import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import JoinClassPanel from "@/components/class/JoinClassPanel";
import { useViewAs } from "@/lib/accounts/viewAs";
import { viewOwnerId } from "@/lib/accounts/workspaceScope";

type JoinedClass = { id: string; name: string };

/**
 * The student front door: My Classes, straight away. No Teaching Hub tiles,
 * no Create Class — everything a student needs lives inside a class.
 */
const StudentClassesPage = () => {
  const navigate = useNavigate();
  // A school administrator may be viewing this student's own page, so the
  // classes shown belong to the student being viewed, never to the viewer.
  const { viewOnly: viewing } = useViewAs();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<JoinedClass[]>([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?next=/student/classes");
      return;
    }
    const { data: memberships } = await supabase
      .from("class_members")
      .select("class_id, classes:class_id(id, name)")
      .eq("user_id", viewOwnerId(userData.user.id));

    setClasses(
      ((memberships ?? []) as { classes: JoinedClass | null }[])
        .map((m) => m.classes)
        .filter((c): c is JoinedClass => Boolean(c)),
    );
    setLoading(false);
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your classes…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <span className="truncate text-[10px] uppercase tracking-[0.35em] text-primary sm:text-xs">MathGPL</span>
        <h1 className="shrink-0 text-base font-semibold tracking-wide sm:text-lg">My Classes</h1>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-16 sm:px-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground sm:col-span-2">
              {viewing
                ? "This student has not joined a class yet."
                : "You have not joined a class yet. Use the join code from your teacher below."}
            </div>
          ) : (
            classes.map((c) => (
              <Link
                key={c.id}
                to={`/student/class/${c.id}`}
                className="min-h-[7rem] rounded-2xl border border-border bg-card/40 p-5 backdrop-blur transition active:scale-[0.98] sm:hover:border-primary/40 sm:hover:shadow-xl"
              >
                <Users className="h-5 w-5 shrink-0 text-primary" />
                <div className="mt-3 truncate text-lg font-semibold">{c.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">Lesson notes, assignments, adventures and gallery.</p>
              </Link>
            ))
          )}
        </section>


        {!viewing && (
          <p className="text-xs text-muted-foreground">
            To add a class, open your school or teacher from the dashboard and use Join Class inside their workspace.
          </p>
        )}

      </main>
    </div>
  );
};

export default StudentClassesPage;
