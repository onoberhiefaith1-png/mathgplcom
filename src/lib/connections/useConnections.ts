import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  discoverAccounts,
  discoverSchools,
  fetchConnectionCounts,
  fetchConnections,
  fetchMySchoolCode,
  fetchVisibility,
  fetchMyShareCode,
  regenerateMyShareCode,
  regenerateSchoolCode,
  requestConnection,
  respondToConnection,
  revokeConnection,
  setAcceptsRequests,
  setGoLive,
  type ConnectionStatus,
  type Relation,
} from "./connections";

/** My Share Code — shown on the account page, regenerable at any time. */
export const useShareCode = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["share-code", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 10 * 60_000,
    queryFn: fetchMyShareCode,
  });

  const regenerate = useMutation({
    mutationFn: regenerateMyShareCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-code"] }),
  });

  return {
    shareCode: query.data ?? null,
    loading: query.isLoading,
    regenerate: regenerate.mutateAsync,
    regenerating: regenerate.isPending,
  };
};

/** Turns a failed Go Live save into a sentence a person can act on. */
export const goLiveError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/profile_missing/.test(message))
    return "Your account profile could not be found. Sign out and sign in again, then try once more.";
  if (/not_authenticated|JWT|401/.test(message))
    return "Your session has expired. Sign in again and try once more.";
  return message || "Something went wrong. Please try again.";
};

/**
 * Go Live and Accept requests — two independent settings.
 *
 * Live answers "can people find me?". Accept requests answers "can people ask
 * to connect with me?". Either can be on without the other.
 */

export const useGoLive = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["go-live", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: () => fetchVisibility(user!.id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["go-live"] });
    queryClient.invalidateQueries({ queryKey: ["discover"] });
  };

  const update = useMutation({
    mutationFn: (live: boolean) => setGoLive(live),
    onSuccess: refresh,
  });

  const requests = useMutation({
    mutationFn: (accept: boolean) => setAcceptsRequests(accept),
    onSuccess: refresh,
  });

  return {
    live: Boolean(query.data?.live),
    acceptsRequests: query.data?.acceptsRequests !== false,
    loading: query.isLoading,
    setLive: update.mutateAsync,
    setAcceptsRequests: requests.mutateAsync,
    saving: update.isPending || requests.isPending,
  };
};

export const useConnections = (status: ConnectionStatus | "all") => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["connections", status, user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: () => fetchConnections(status),
  });
};

/**
 * Rejected requests, with the time they were rejected, filtered to the
 * account's retention window and re-checked every minute so a row disappears
 * on its own.
 */
export const useRejectedRequests = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const retention = useRetentionSetting();

  const query = useQuery({
    queryKey: ["rejected-requests", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: fetchRejectedRequests,
  });

  return {
    rows: retainedRejections(query.data ?? [], retention.hours, tick),
    loading: query.isLoading || retention.loading,
    retention,
  };
};

/** How long this account keeps rejected requests visible. */
export const useRetentionSetting = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["rejected-retention", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: fetchRetentionHours,
  });

  const save = useMutation({
    mutationFn: (hours: number) => saveRetentionHours(hours),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rejected-retention"] }),
  });

  return {
    hours: query.data ?? DEFAULT_RETENTION_HOURS,
    loading: query.isLoading,
    setHours: save.mutateAsync,
    saving: save.isPending,
  };
};

export const useConnectionCounts = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["connection-counts", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchConnectionCounts,
  });
  return {
    counts: query.data ?? {
      schools: 0,
      teachers: 0,
      students: 0,
      children: 0,
      parents: 0,
      pendingIncoming: 0,
    },
    loading: query.isLoading,
  };
};

/** Sending, answering and withdrawing requests, with every list kept fresh. */
export const useConnectionActions = () => {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["connections"] });
    queryClient.invalidateQueries({ queryKey: ["connection-counts"] });
    queryClient.invalidateQueries({ queryKey: ["discover"] });
    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  }, [queryClient]);

  const send = useMutation({
    mutationFn: ({ userId, relation, message }: { userId: string; relation: Relation; message?: string }) =>
      requestConnection(userId, relation, message),
    onSuccess: refresh,
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToConnection(id, accept),
    onSuccess: refresh,
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => revokeConnection(id),
    onSuccess: refresh,
  });

  return {
    send: send.mutateAsync,
    sending: send.isPending,
    respond: respond.mutateAsync,
    responding: respond.isPending,
    withdraw: withdraw.mutateAsync,
    withdrawing: withdraw.isPending,
  };
};

export const useDiscover = (category: "school" | "teacher" | "student" | "parent", query: string) =>
  useQuery({
    queryKey: ["discover", category, query],
    queryFn: () => (category === "school" ? discoverSchools(query) : discoverAccounts(category, query)),
  });

/**
 * The signed-in school's own School Code — the direct route a teacher or
 * student uses to ask to join, alongside Community discovery.
 */
export const useSchoolCode = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["school-code", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 10 * 60_000,
    queryFn: fetchMySchoolCode,
  });

  const regenerate = useMutation({
    mutationFn: (orgId: string) => regenerateSchoolCode(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-code"] }),
  });

  return {
    school: query.data ?? null,
    loading: query.isLoading,
    regenerate: regenerate.mutateAsync,
    regenerating: regenerate.isPending,
  };
};
