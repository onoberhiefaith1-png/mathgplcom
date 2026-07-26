import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users, BookOpen, Presentation, Settings, Copy, Check, ClipboardList, Compass, Gamepad2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import JoinRequestsPanel from "@/components/class/JoinRequestsPanel";
import InviteByMathGPLId from "@/components/class/InviteByMathGPLId";

type ClassRow = { id: string; name: string; class_code: string; join_code: string };

const ClassDashboardPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/teaching-hub/classes/${classId}`);
        return;
      }
      const redirect = await ensureClassOwner(classId!, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, class_code")
        .eq("id", classId!)
        .single();
      if (error || !data) {
        toast({ title: "Class not found", variant: "destructive" });
        navigate("/teaching-hub/classes");
        return;
      }
      const { data: code } = await supabase.rpc("get_class_join_code", { _class_id: classId! });
      setCls({ ...data, join_code: (code as string | null) ?? "" });
      setLoading(false);
    })();
  }, [classId, navigate, toast]);

  const inviteLink = cls ? `${window.location.origin}/join/${cls.join_code}` : "";
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  const tiles: { label: string; icon: typeof Users; to: string }[] = [
    { label: "Students", icon: Users, to: `/teaching-hub/classes/${classId}/students` },
    { label: "Lesson Notes", icon: BookOpen, to: `/teaching-hub/classes/${classId}/lesson-notes` },
    { label: "SmartBoard", icon: Presentation, to: `/teaching-hub/classes/${classId}/smartboard` },
    { label: "Assignments", icon: ClipboardList, to: `/teaching-hub/classes/${classId}/assignments` },
    { label: "Adventures", icon: Compass, to: `/teaching-hub/classes/${classId}/adventures` },
    { label: "Games", icon: Gamepad2, to: `/teaching-hub/classes/${classId}/games` },
    { label: "Gallery", icon: ImageIcon, to: `/teaching-hub/classes/${classId}/gallery` },
    { label: "Settings", icon: Settings, to: `/teaching-hub/classes/${classId}` },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/teaching-hub/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Classes
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Class Dashboard</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {loading || !cls ? (
          <div className="text-center text-muted-foreground">Loading…</div>
        ) : (
          <>
            <section className="mb-8 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
              <div className="text-3xl font-semibold">{cls.name}</div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {([
                  { label: "Class ID", value: cls.class_code },
                  { label: "Join Code", value: cls.join_code },
                  { label: "Invite Link", value: inviteLink },
                ] as const).map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs">{row.value}</code>
                      <button
                        type="button"
                        onClick={() => copy(row.label, row.value)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
                        aria-label={`Copy ${row.label}`}
                      >
                        {copied === row.label ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {tiles.map(({ label, icon: Icon, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card/40 p-4 text-center backdrop-blur transition hover:scale-[1.02] hover:border-primary/40 hover:shadow-xl"
                >
                  <Icon className="h-7 w-7 text-primary" />
                  <div className="text-sm font-medium">{label}</div>
                </Link>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <JoinRequestsPanel classId={cls.id} />
              <InviteByMathGPLId classId={cls.id} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ClassDashboardPage;
