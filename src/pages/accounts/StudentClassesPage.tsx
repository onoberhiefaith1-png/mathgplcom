import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import JoinClassPanel from "@/components/class/JoinClassPanel";

type JoinedClass = { id: string; name: string };

/**
 * The student front door: My Classes, straight away. No Teaching Hub tiles,
 * no Create Class — everything a student needs lives inside a class.
 */
const StudentClassesPage = () => {
  const navigate = useNavigate();
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
      .eq("user_id", userData.user.id);

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
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-xs uppercase tracking-[0.35em] text-primary">MathGPL</span>
        <h1 className="text-lg font-semibold tracking-wide">My Classes</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-8 px-6 pb-16">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground sm:col-span-2">
              You have not joined a class yet. Use the join code from your teacher below.
            </div>
          ) : (
            classes.map((c) => (
              <Link
                key={c.id}
                to={`/student/class/${c.id}`}
                className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur transition hover:border-primary/40 hover:shadow-xl"
              >
                <Users className="h-5 w-5 text-primary" />
                <div className="mt-3 truncate text-lg font-semibold">{c.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">Lesson notes, assignments, adventures and gallery.</p>
              </Link>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Join a class</h2>
          <JoinClassPanel />
        </section>
      </main>
    </div>
  );
};

export default StudentClassesPage;
