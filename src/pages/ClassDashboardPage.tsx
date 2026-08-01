import { useEffect, useState } from "react";
import { classRoot, productTerms, spaceListPath } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import ClassPageShell from "@/components/class/ClassPageShell";

import { ArrowLeft, Users, BookOpen, Presentation, Settings, Copy, Check, ClipboardList, Compass, Gamepad2, Image as ImageIcon, BarChart3 } from "lucide-react";
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
        navigate(`/auth?redirect=${classRoot()}/${classId}`);
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
        navigate(spaceListPath());
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
  const tiles: { label: string; icon: typeof Users; to: string; tone: string; blurb: string }[] = [
    { label: productTerms().people, icon: Users, to: `${classRoot()}/${classId}/students`, tone: "from-violet-500 to-purple-600", blurb: `Everyone in this ${productTerms().space.toLowerCase()}.` },
    { label: "Lesson Notes", icon: BookOpen, to: `${classRoot()}/${classId}/lesson-notes`, tone: "from-sky-500 to-blue-600", blurb: "Notes stored in this class." },
    { label: "SmartBoard", icon: Presentation, to: `${classRoot()}/${classId}/smartboard`, tone: "from-fuchsia-500 to-pink-600", blurb: "Teach live on the board." },
    { label: productTerms().assignments, icon: ClipboardList, to: `${classRoot()}/${classId}/assignments`, tone: "from-amber-400 to-orange-500", blurb: "Set work and track progress." },
    { label: productTerms().adventures, icon: Compass, to: `${classRoot()}/${classId}/adventures`, tone: "from-emerald-500 to-teal-600", blurb: "Game-based practice." },
    { label: "Games", icon: Gamepad2, to: `${classRoot()}/${classId}/games`, tone: "from-cyan-500 to-sky-600", blurb: "Live game challenges." },
    { label: "Gallery", icon: ImageIcon, to: `${classRoot()}/${classId}/gallery`, tone: "from-rose-500 to-red-600", blurb: "Rewards and student work." },
    { label: "Report", icon: BarChart3, to: `${classRoot()}/${classId}/report`, tone: "from-lime-500 to-green-600", blurb: "Progress and trends." },
    { label: "Settings", icon: Settings, to: `${classRoot()}/${classId}`, tone: "from-slate-500 to-slate-700", blurb: "Class preferences." },
  ];

  if (loading || !cls) {
    return (
      <ClassPageShell backTo={spaceListPath()} backLabel={productTerms().spacePlural} title={`${productTerms().space} Dashboard`}>
        <div className="text-center text-sm text-dash-surface/70">Loading…</div>
      </ClassPageShell>
    );
  }

  return (
    <ClassPageShell
      backTo={spaceListPath()}
      backLabel={productTerms().spacePlural}
      title={cls.name}
      subtitle={`${productTerms().space} workspace — lesson notes, board, work, rewards and reports.`}
    >
      <section className="mb-6 rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            { label: "Class ID", value: cls.class_code },
            { label: "Join Code", value: cls.join_code },
            { label: "Invite Link", value: inviteLink },
          ] as const).map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">{row.label}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-dash-border bg-dash-surface px-2.5 py-1.5 text-xs text-dash-surface-foreground">
                  {row.value}
                </code>
                <button
                  type="button"
                  onClick={() => copy(row.label, row.value)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-dash-gold hover:text-dash-surface-foreground"
                  aria-label={`Copy ${row.label}`}
                >
                  {copied === row.label ? <Check className="h-3.5 w-3.5 text-dash-gold" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ label, icon: Icon, to, tone, blurb }) => (
          <Link
            key={label}
            to={to}
            className="group relative overflow-hidden rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_hsl(224_60%_6%/0.7)] active:translate-y-0 active:scale-[0.99]"
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone}`} />
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-dash-surface shadow-md transition-transform duration-200 group-hover:scale-110`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="mt-4 text-lg font-semibold text-dash-surface-foreground">{label}</div>
            <p className="mt-1 text-xs text-dash-surface-muted">{blurb}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 [&_*]:border-dash-border/70 [&_code]:text-dash-surface-foreground">
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-5 text-dash-surface-foreground shadow-[var(--shadow-dash)]">
          <JoinRequestsPanel classId={cls.id} />
        </div>
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-5 text-dash-surface-foreground shadow-[var(--shadow-dash)]">
          <InviteByMathGPLId classId={cls.id} />
        </div>
      </div>
    </ClassPageShell>
  );
};


export default ClassDashboardPage;
