import { useEffect, useState } from "react";
import { classRoot, productTerms, spaceListPath } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import ClassPageShell from "@/components/class/ClassPageShell";
import SectionCard from "@/components/ui/SectionCard";
import { sectionCardStyle, type SectionThemeKey } from "@/lib/theme/sectionThemes";

import { Users, BookOpen, Presentation, Settings, Copy, Check, ClipboardList, Compass, Gamepad2, Image as ImageIcon, BarChart3, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useViewAs } from "@/lib/accounts/viewAs";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import JoinRequestsPanel from "@/components/class/JoinRequestsPanel";
import InviteByMathGPLId from "@/components/class/InviteByMathGPLId";
import ClassCommunityShare from "@/components/class/ClassCommunityShare";

type ClassRow = { id: string; name: string; class_code: string; description: string | null; join_code: string };

const ClassDashboardPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  // A school reviewing a shared workspace is not the owner but may look.
  const { viewOnly } = useViewAs();
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
      const redirect = viewOnly ? null : await ensureClassOwner(classId!, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, class_code, description")
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
  }, [classId, navigate, toast, viewOnly]);

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
  const tiles: { label: string; icon: typeof Users; to: string; theme: SectionThemeKey; blurb: string }[] = [
    { label: productTerms().people, icon: Users, to: `${classRoot()}/${classId}/students`, theme: "students", blurb: `Everyone in this ${productTerms().space.toLowerCase()}.` },
    { label: "Lesson Notes", icon: BookOpen, to: `${classRoot()}/${classId}/lesson-notes`, theme: "lessonNotes", blurb: "Notes stored in this class." },
    { label: "Courses", icon: GraduationCap, to: `${classRoot()}/${classId}/courses`, theme: "courses", blurb: "Build this class's learning pathway." },
    { label: "SmartBoard", icon: Presentation, to: `${classRoot()}/${classId}/smartboard`, theme: "smartboard", blurb: "Teach live on the board." },
    { label: productTerms().assignments, icon: ClipboardList, to: `${classRoot()}/${classId}/assignments`, theme: "assignments", blurb: "Set work and track progress." },
    { label: productTerms().adventures, icon: Compass, to: `${classRoot()}/${classId}/adventures`, theme: "adventure", blurb: "Game-based practice." },
    { label: "Games", icon: Gamepad2, to: `${classRoot()}/${classId}/games`, theme: "games", blurb: "Live game challenges." },
    { label: "Gallery", icon: ImageIcon, to: `${classRoot()}/${classId}/gallery`, theme: "gallery", blurb: "Rewards and student work." },
    { label: "Report", icon: BarChart3, to: `${classRoot()}/${classId}/report`, theme: "reports", blurb: "Progress and trends." },
    { label: "Settings", icon: Settings, to: `${classRoot()}/${classId}`, theme: "settings", blurb: "Class preferences." },
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
      <section className="mb-6 rounded-2xl border border-section-ink/15 p-5 text-section-ink" style={sectionCardStyle("classes")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            { label: "Class ID", value: cls.class_code },
            { label: "Join Code", value: cls.join_code },
            { label: "Invite Link", value: inviteLink },
          ] as const).map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-section-ink-muted">{row.label}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-section-ink/20 bg-section-ink/10 px-2.5 py-1.5 text-xs text-section-ink">
                  {row.value}
                </code>
                <button
                  type="button"
                  onClick={() => copy(row.label, row.value)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-section-ink/25 text-section-ink-muted transition hover:border-section-ink hover:text-section-ink"
                  aria-label={`Copy ${row.label}`}
                >
                  {copied === row.label ? <Check className="h-3.5 w-3.5 text-dash-gold" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ClassCommunityShare classId={cls.id} className={cls.name} description={cls.description} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ label, icon: Icon, to, theme, blurb }) => (
          <SectionCard key={label} theme={theme} to={to} label={label} description={blurb} icon={Icon} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <JoinRequestsPanel classId={cls.id} light />
        <InviteByMathGPLId classId={cls.id} light />
      </div>
    </ClassPageShell>
  );
};


export default ClassDashboardPage;
