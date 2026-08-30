/**
 * THE ACADEMY WORLD — one shared 3D product-discovery environment.
 *
 * Entered from the rotating building on the homepage. The corridor, rooms and
 * showroom shelves are all read from the database, so what a teacher builds in
 * /academy/edit is exactly what a student walks through here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Star } from "lucide-react";
import HallwayScene from "@/components/academy/world/HallwayScene";
import ShowroomPanel from "@/components/academy/world/ShowroomPanel";
import { ensureAcademy, loadAcademyTree, loadProductCatalogue } from "@/lib/academy/api";
import { productRoute, type AcademyProduct, type AcademyTree } from "@/lib/academy/types";
import { useAccount } from "@/lib/accounts/useAccount";

const AcademyWorldPage = () => {
  const { orgId, isLoading: accountLoading } = useAccount();
  const navigate = useNavigate();
  const [tree, setTree] = useState<AcademyTree | null>(null);
  const [catalogue, setCatalogue] = useState<AcademyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
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
        const [loaded, products] = await Promise.all([loadAcademyTree(academy), loadProductCatalogue()]);
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

  const rooms = useMemo(
    () => (tree?.rooms ?? []).filter((r) => r.is_visible || tree?.canEdit),
    [tree],
  );
  const room = rooms.find((r) => r.id === roomId) ?? null;
  const category = room?.categories.find((c) => c.id === categoryId) ?? null;
  const topic = category?.topics.find((t) => t.id === topicId) ?? null;
  const subtopic = topic?.subtopics.find((s) => s.id === subtopicId) ?? null;

  /** Featured shelf: every placement a teacher marked as featured, anywhere. */
  const featured = useMemo(
    () =>
      rooms.flatMap((r) =>
        r.categories.flatMap((c) =>
          c.topics.flatMap((t) =>
            t.subtopics.flatMap((s) =>
              s.placements.filter((p) => p.is_featured && p.is_visible).map((p) => ({ placement: p, path: `${r.name} · ${t.name}` })),
            ),
          ),
        ),
      ),
    [rooms],
  );

  const enterRoom = useCallback((id: string) => {
    setRoomId(id);
    setCategoryId(null);
    setTopicId(null);
    setSubtopicId(null);
  }, []);

  if (loading || accountLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening the Academy…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm">
          Back to the building
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0f18]">
      {rooms.length > 0 ? (
        <HallwayScene rooms={rooms} focus={focus} onFocusChange={setFocus} onEnterRoom={enterRoom} />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">The Academy hallway is empty</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            No rooms have been created yet. A teacher or administrator builds the hallway, rooms and
            shelves, then courses and games appear here for learners.
          </p>
          {tree?.canEdit && (
            <Link
              to="/academy/edit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <Pencil className="h-4 w-4" /> Build the Academy
            </Link>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4">
        <Link
          to="/"
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 text-sm font-medium text-foreground backdrop-blur"
        >
          <ChevronLeft className="h-4 w-4" /> Building
        </Link>
        <span className="pointer-events-none truncate text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
          {tree?.academy.name || "Academy"}
        </span>
        {tree?.canEdit ? (
          <Link
            to="/academy/edit"
            className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-primary/50 bg-background/70 px-4 text-sm font-medium text-primary backdrop-blur"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        ) : (
          <span className="w-[92px]" />
        )}
      </div>

      {/* Corridor controls + featured shelf, hidden while inside a room */}
      {!room && rooms.length > 0 && (
        <>
          <div className="absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-3 px-4">
            {featured.length > 0 && (
              <div className="flex w-full max-w-4xl gap-2 overflow-x-auto pb-1">
                {featured.slice(0, 8).map(({ placement, path }) => {
                  const route = productRoute(placement.product_kind, placement.product_id);
                  const label =
                    placement.title_override ||
                    catalogue.find((c) => c.kind === placement.product_kind && c.id === placement.product_id)?.title ||
                    "Product";
                  const body = (
                    <>
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      <span className="truncate">{label}</span>
                      <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                        {path}
                      </span>
                    </>
                  );
                  return route ? (
                    <Link
                      key={placement.id}
                      to={route}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/75 px-4 text-sm text-foreground backdrop-blur"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span
                      key={placement.id}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 text-sm text-muted-foreground backdrop-blur"
                    >
                      {body}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/75 p-1 backdrop-blur">
              <button
                type="button"
                aria-label="Previous room"
                onClick={() => setFocus((f) => Math.max(0, f - 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => rooms[focus] && enterRoom(rooms[focus].id)}
                className="min-h-[44px] rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Enter {rooms[focus]?.name ?? "room"}
              </button>
              <button
                type="button"
                aria-label="Next room"
                onClick={() => setFocus((f) => Math.min(rooms.length - 1, f + 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {room && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <ShowroomPanel
            room={room}
            category={category}
            topic={topic}
            subtopic={subtopic}
            catalogue={catalogue}
            onSelectCategory={setCategoryId}
            onSelectTopic={setTopicId}
            onSelectSubtopic={setSubtopicId}
            onLeaveRoom={() => {
              setRoomId(null);
              navigate("/academy", { replace: true });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AcademyWorldPage;
