/**
 * ACADEMY ROOM — a deep-linkable leaf route for one room's sections.
 *
 * Room doorways in the hallway zoom in and navigate here; the same ShowroomPanel
 * that the world page used to render inline is reused, so there is one renderer.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ChevronLeft, Loader2 } from "lucide-react";
import ShowroomPanel from "@/components/academy/world/ShowroomPanel";
import { ensureAcademy, loadAcademyTree, loadProductCatalogue } from "@/lib/academy/api";
import type { AcademyProduct, AcademyTree } from "@/lib/academy/types";
import { useAccount } from "@/lib/accounts/useAccount";

const AcademyRoomPage = () => {
  const { orgId, isLoading: accountLoading } = useAccount();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<AcademyTree | null>(null);
  const [catalogue, setCatalogue] = useState<AcademyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [subtopicId, setSubtopicId] = useState<string | null>(null);

  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const academy = await ensureAcademy(orgId ?? null);
        if (!academy) {
          if (!cancelled) setError("Sign in to enter the Academy.");
          return;
        }
        const [loaded, products] = await Promise.all([
          loadAcademyTree(academy),
          loadProductCatalogue(),
        ]);
        if (cancelled) return;
        setTree(loaded);
        setCatalogue(products);
      } catch (e: unknown) {
        if (!cancelled) setError(String((e as Error)?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, accountLoading]);

  const room = useMemo(
    () =>
      (tree?.rooms ?? []).find((r) => r.id === roomId && (r.is_visible || tree?.canEdit)) ?? null,
    [tree, roomId],
  );
  const category = room?.categories.find((c) => c.id === categoryId) ?? null;
  const topic = category?.topics.find((t) => t.id === topicId) ?? null;
  const subtopic = topic?.subtopics.find((s) => s.id === subtopicId) ?? null;

  if (loading || accountLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening the room…
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error || "This room could not be found."}</p>
        <Link to="/academy" className="rounded-full border border-border px-5 py-2 text-sm">
          Back to the Academy
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0f18]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4">
        <Link
          to="/academy"
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 text-sm font-medium text-foreground backdrop-blur"
        >
          <ChevronLeft className="h-4 w-4" /> Academy
        </Link>
        <span className="pointer-events-none truncate text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
          {tree?.academy.name || "Academy"}
        </span>
        <span className="w-[92px]" />
      </div>

      <ShowroomPanel
        room={room}
        category={category}
        topic={topic}
        subtopic={subtopic}
        catalogue={catalogue}
        onSelectCategory={setCategoryId}
        onSelectTopic={setTopicId}
        onSelectSubtopic={setSubtopicId}
        onLeaveRoom={() => navigate("/academy")}
      />
    </div>
  );
};

export default AcademyRoomPage;