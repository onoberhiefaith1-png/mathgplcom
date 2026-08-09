import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  discoverAccounts,
  discoverSchools,
  fetchConnectionCounts,
  fetchConnections,
  fetchVisibility,
  fetchMyShareCode,
  regenerateMyShareCode,
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
