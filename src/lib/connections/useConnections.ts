import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  discoverAccounts,
  discoverSchools,
  fetchConnectionCounts,
  fetchConnections,
  fetchGoLive,
  fetchMyShareCode,
  regenerateMyShareCode,
  requestConnection,
  respondToConnection,
  revokeConnection,
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

/** Go Live controls Community discoverability only. */
export const useGoLive = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["go-live", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: () => fetchGoLive(user!.id),
  });

  const update = useMutation({
    mutationFn: (live: boolean) => setGoLive(live),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["go-live"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });

  return {
    live: Boolean(query.data),
    loading: query.isLoading,
    setLive: update.mutateAsync,
    saving: update.isPending,
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

export const useDiscover = (category: "school" | "teacher" | "student", query: string) =>
  useQuery({
    queryKey: ["discover", category, query],
    queryFn: () => (category === "school" ? discoverSchools(query) : discoverAccounts(category, query)),
  });
