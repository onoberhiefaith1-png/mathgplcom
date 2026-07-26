import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { getOrCreateClassGallery } from "@/lib/games/classGallery";
import { listStudentGroupIds } from "@/lib/adventures/groups";
import { normalizeCanvas, type GameCanvas as GameCanvasT } from "@/lib/games/types";
import { useGalleryScrollMemory } from "@/lib/games/galleryScroll";
import { parseAnimateReward, useGalleryAwards } from "@/hooks/useGalleryAwards";

/**
 * Student-facing Gallery — read-only mirror of the teacher's Gallery canvas.
 * The layout is shared by every group; the student's own group is resolved
 * automatically and only that group's earned rewards are shown.
 */
const StudentGalleryPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("Gallery");
  const [canvas, setCanvas] = useState<GameCanvasT | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const galleryScroll = useGalleryScrollMemory(classId);

  const animate = useMemo(
    () => parseAnimateReward(searchParams.get("animateReward")),
    [searchParams],
  );

  const awards = useGalleryAwards({ classId, groupId, animate });

  const load = useCallback(async () => {
    if (!classId) return;
    try {
      const g = await getOrCreateClassGallery(classId);
      setCanvas(normalizeCanvas(g.canvas));
    } catch (e) {
      console.error(e);
    }
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/gallery`);
        return;
      }
      const uid = userData.user.id;
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!membership) {
        navigate("/join");
        return;
      }
      const [{ data: cls }, myGroups] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        listStudentGroupIds(classId, uid),
      ]);
      if (cancelled) return;
      setClassName((cls as { name?: string } | null)?.name ?? "Gallery");
      // Students never pick a group — theirs is resolved for them.
      setGroupId(myGroups[0] ?? null);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, navigate, load]);

  // Live-mirror teacher edits.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-gallery-${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_galleries", filter: `class_id=eq.${classId}` },
          () => { void load(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, load]);

  if (loading || !canvas) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening gallery…
      </div>
    );
  }

  const elements = [...(canvas.scenes[0]?.elements ?? []), ...awards.elements];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          to={`/student/class/${classId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Classroom
        </Link>
        <h1 className="truncate text-lg font-semibold tracking-wide">{className} Gallery</h1>
        <div className="w-24 text-right">
          {awards.flying && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Reward arriving…
            </span>
          )}
        </div>
      </header>
      <main ref={galleryScroll.ref} className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl p-4">
          <GameCanvas
            elements={elements}
            selectedId={null}
            pinnedId={null}
            editable={false}
            heightUnits={Math.max(1, Math.floor(canvas.heightUnits ?? 1))}
          />
        </div>
      </main>
    </div>
  );
};

export default StudentGalleryPage;
