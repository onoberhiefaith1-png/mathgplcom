/**
 * Restores the Academia drill-down for the signed-in user.
 * Device storage paints first; the account row replaces it when it arrives.
 * Changing a level clears only the levels under it. A deleted or inaccessible
 * level falls back to the deepest one that is still in the catalog.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { loadSessions, type AcademiaSession } from "@/lib/academia/api";
import {
  DRILL_TRAIL_PENDING_MS,
  EMPTY_DRILL_TRAIL,
  chooseStoredTrail,
  currentDrillTrail,
  drillTrailKey,
  isEmptyDrillTrail,
  normalizeDrillTrail,
  readDrillEnvelope,
  restoreDrillTrail,
  sameDrillTrail,
  searchParamsEqual,
  selectDrillLevel,
  subscribeDrillTrail,
  trailFromSearchParams,
  trailToSearchParams,
  trailVisibleInAcademia,
  type DrillCatalog,
  type DrillTrail,
  type DrillTrailKey,
} from "@/lib/academia/drillTrail";
import {
  adoptDrillTrail,
  drillTrailQueryKey,
  fetchDrillTrail,
  rememberDrillTrail,
} from "@/lib/academia/drillTrailRemote";

type Options = {
  /** When false the hook does not read or write (another screen owns the trail). */
  active: boolean;
  academiaId: string | null;
  /** The tree (and any access filter) has loaded. */
  catalogReady: boolean;
  /** Mirror the trail into this page's query string so back/forward restores it. */
  syncUrl: boolean;
  classes: DrillCatalog["classes"];
  subjects: DrillCatalog["subjects"];
  topics: DrillCatalog["topics"];
  subtopics: DrillCatalog["subtopics"];
};

const DRILL_PATHS = new Set(["/academia", "/school/academia"]);

export function useDrillTrailSnapshot(): DrillTrail {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useSyncExternalStore(
    subscribeDrillTrail,
    () => currentDrillTrail(userId),
    () => EMPTY_DRILL_TRAIL,
  );
}

export function useAcademiaDrillTrail(opts: Options) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const saved = useSyncExternalStore(
    subscribeDrillTrail,
    () => currentDrillTrail(userId),
    () => EMPTY_DRILL_TRAIL,
  );
  const urlReady = useRef(false);
  const urlUser = useRef<string | null>(null);
  if (urlUser.current !== userId) {
    urlUser.current = userId;
    urlReady.current = false;
  }

  const remote = useQuery({
    queryKey: drillTrailQueryKey(userId ?? ""),
    enabled: opts.active && !!userId,
    queryFn: fetchDrillTrail,
    staleTime: 0,
  });

  const remoteReady = !!userId && (remote.isSuccess || remote.isError);
  const serverRecord = remote.data?.status === "ok" ? remote.data.record : null;
  const serverKnown = remote.isSuccess && remote.data?.status === "ok";
  const base = serverKnown
    ? chooseStoredTrail(
        userId ? readDrillEnvelope(userId) : null,
        serverRecord,
        true,
      )
    : saved;

  const visibility = useMemo(
    () =>
      trailVisibleInAcademia(
        base,
        opts.academiaId,
        opts.catalogReady ? opts.classes : undefined,
      ),
    [base, opts.academiaId, opts.catalogReady, opts.classes],
  );

  const sessionsQ = useQuery({
    queryKey: ["academia-sessions", visibility.trail.subtopicId],
    enabled: opts.active && opts.catalogReady && !!visibility.trail.subtopicId,
    queryFn: () => loadSessions(visibility.trail.subtopicId!),
  });
  const sessionsPending =
    opts.catalogReady && !!visibility.trail.subtopicId && !sessionsQ.isFetched;
  const sessionNodes = useMemo(
    () =>
      sessionsQ.isSuccess
        ? sessionsQ.data.map((row) => ({
            id: row.id,
            subtopic_id: row.subtopic_id,
          }))
        : undefined,
    [sessionsQ.isSuccess, sessionsQ.data],
  );

  const display = useMemo(() => {
    if (!opts.catalogReady) return visibility.trail;
    return restoreDrillTrail(visibility.trail, {
      classes: opts.classes,
      subjects: opts.subjects,
      topics: opts.topics,
      subtopics: opts.subtopics,
      sessions: sessionNodes,
    });
  }, [
    opts.catalogReady,
    visibility.trail,
    opts.classes,
    opts.subjects,
    opts.topics,
    opts.subtopics,
    sessionNodes,
  ]);

  const displayKey = drillTrailKey(display);
  const baseKey = drillTrailKey(base);
  const displayRef = useRef(display);
  const baseRef = useRef(base);
  displayRef.current = display;
  baseRef.current = base;

  const writeUrl = useCallback(
    (trail: DrillTrail, replace: boolean) => {
      if (!opts.syncUrl || !opts.active || typeof window === "undefined")
        return;
      const current = new URLSearchParams(window.location.search);
      const next = trailToSearchParams(trail, current);
      if (searchParamsEqual(current, next)) return;
      urlReady.current = true;
      setParams(next, { replace });
    },
    [opts.syncUrl, opts.active, setParams],
  );

  const publish = useCallback(
    (trail: DrillTrail, replace: boolean) => {
      if (!userId) return;
      void rememberDrillTrail(userId, trail, qc);
      writeUrl(trail, replace);
    },
    [userId, qc, writeUrl],
  );

  useEffect(() => {
    if (!opts.active || !userId || !serverKnown) return;
    const envelope = readDrillEnvelope(userId);
    const chosen = chooseStoredTrail(envelope, serverRecord, true);
    if (!sameDrillTrail(currentDrillTrail(userId), chosen)) {
      const fromServer =
        !!serverRecord && sameDrillTrail(chosen, serverRecord.trail);
      adoptDrillTrail(
        userId,
        chosen,
        fromServer ? serverRecord!.updatedAt : (envelope?.updatedAt ?? null),
      );
    }
  }, [opts.active, userId, serverKnown, serverRecord, qc]);

  useEffect(() => {
    if (
      !opts.active ||
      !userId ||
      !remoteReady ||
      !visibility.owned ||
      !opts.catalogReady ||
      sessionsPending
    )
      return;
    const shown = displayRef.current;
    const needsStrip = !sameDrillTrail(shown, baseRef.current);
    // No account row yet: upload the restored trail, including one that is already valid.
    const needsSeed = serverKnown && !serverRecord && !isEmptyDrillTrail(shown);
    const envelope = readDrillEnvelope(userId);
    const pendingFresh =
      !!envelope?.pending &&
      envelope.pendingAt != null &&
      Date.now() - envelope.pendingAt < DRILL_TRAIL_PENDING_MS;
    if (!needsStrip && !needsSeed && !pendingFresh) return;
    publish(shown, true);
  }, [
    opts.active,
    userId,
    remoteReady,
    visibility.owned,
    opts.catalogReady,
    sessionsPending,
    displayKey,
    baseKey,
    serverKnown,
    serverRecord,
    publish,
  ]);

  useEffect(() => {
    if (
      !opts.syncUrl ||
      !opts.active ||
      !remoteReady ||
      !opts.catalogReady ||
      sessionsPending
    )
      return;
    if (urlReady.current) return;
    urlReady.current = true;
    writeUrl(displayRef.current, true);
  }, [
    opts.syncUrl,
    opts.active,
    remoteReady,
    opts.catalogReady,
    sessionsPending,
    displayKey,
    writeUrl,
  ]);

  useEffect(() => {
    if (!opts.syncUrl || !opts.active) return;
    const onPop = () => {
      const path = window.location.pathname.replace(/\/$/, "");
      if (!DRILL_PATHS.has(path)) return;
      urlReady.current = true;
      const fromUrl = trailFromSearchParams(
        new URLSearchParams(window.location.search),
      );
      const next = opts.academiaId
        ? { ...fromUrl, academiaId: opts.academiaId }
        : fromUrl;
      if (!userId) return;
      void rememberDrillTrail(userId, next, qc);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [opts.syncUrl, opts.active, opts.academiaId, userId, qc]);

  const select = useCallback(
    (level: DrillTrailKey, id: string) => {
      const view = trailVisibleInAcademia(
        baseRef.current,
        opts.academiaId,
        opts.catalogReady ? opts.classes : undefined,
      );
      const start = view.owned
        ? view.trail
        : { ...EMPTY_DRILL_TRAIL, academiaId: opts.academiaId };
      publish(selectDrillLevel(start, level, id), false);
    },
    [opts.academiaId, opts.catalogReady, opts.classes, publish],
  );

  const sessions: AcademiaSession[] = sessionsQ.data ?? [];

  return {
    classId: display.classId,
    subjectId: display.subjectId,
    topicId: display.topicId,
    subtopicId: display.subtopicId,
    sessionId: display.sessionId,
    sessions,
    selectClass: (id: string) => select("classId", id),
    selectSubject: (id: string) => select("subjectId", id),
    selectTopic: (id: string) => select("topicId", id),
    selectSubtopic: (id: string) => select("subtopicId", id),
    selectSession: (id: string) => select("sessionId", id),
  };
}

export function sessionTrail(input: {
  academiaId: string | null;
  classId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  sessionId: string;
}): DrillTrail {
  return normalizeDrillTrail({
    academiaId: input.academiaId,
    classId: input.classId,
    subjectId: input.subjectId,
    topicId: input.topicId,
    subtopicId: input.subtopicId,
    sessionId: input.sessionId,
  });
}
