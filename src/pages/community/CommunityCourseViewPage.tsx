/**
 * A published course, seen from Community.
 *
 * Community never owns a course. The listing carries only a reference, so this
 * page loads the teacher's ORIGINAL course tree by `source_id` and streams the
 * teacher's original videos. Nothing is copied, and nothing here is editable.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import StudentView from "@/components/coursebuilder/StudentView";
import { supabase } from "@/integrations/supabase/client";
import { loadCourseTree } from "@/lib/courses/api";
import type { CourseTree } from "@/lib/courses/types";

interface Listing {
  title: string;
  description: string | null;
  username: string | null;
  source_id: string | null;
}

const CommunityCourseViewPage = () => {
  const params = useParams() as { id?: string };
  const listingId = params.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!listingId) return;
      setLoading(true);
      setError("");
      try {
        const { data, error: listErr } = await supabase
          .from("community_resource_cards")
          .select("title, description, username, source_id, kind, status")
          .eq("id", listingId)
          .maybeSingle();
        if (listErr) throw listErr;
        if (!data) throw new Error("This course listing is no longer available.");
        const row = data as unknown as Listing & { kind: string };
        if (row.kind !== "course" || !row.source_id) {
          throw new Error("This listing is not a course.");
        }
        const loaded = await loadCourseTree(row.source_id);
        if (!alive) return;
        setListing(row);
        setTree(loaded);
      } catch (e) {
        if (alive) setError(String((e as Error)?.message ?? e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingId]);

  return (
    <CommunityShell
      active="/community/courses"
      title={listing?.title ?? (loading ? "Loading course…" : "Course")}
      subtitle={
        listing
          ? "Shared to Community by its owner. You are viewing the original course."
          : undefined
      }
      showSearch={false}
    >
      <Link
        to="/community/courses"
        className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-dash-surface/65 hover:text-dash-surface"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Courses
      </Link>

      {listing?.username && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-dash-surface/75">
          <UserRound className="h-3.5 w-3.5" /> @{listing.username}
        </p>
      )}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-dash-surface/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the course…
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
      )}

      {tree && (
        <div className="max-w-3xl">
          {listing?.description && (
            <p className="mb-4 text-sm text-dash-surface/75">{listing.description}</p>
          )}
          <StudentView tree={tree} />
        </div>
      )}
    </CommunityShell>
  );
};

export default CommunityCourseViewPage;
