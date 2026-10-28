/** React bindings for the Community people directory. */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/accounts/useAccount";
import {
  applyDirectoryFilters,
  getCommunityPerson,
  listCommunityPeople,
  loadMyCommunityProfile,
  recordProfileView,
  type CommunityPerson,
  type CommunityRoleKind,
  type DirectoryFilters,
} from "./people";
import { loadMyConnections, sendCommunityRequest, stateForPerson, type RequestState } from "./requests";

export const useCommunityPeople = (
  role: CommunityRoleKind | null,
  query: string,
  filters: DirectoryFilters = {},
) => {
  const people = useQuery({
    queryKey: ["community", "people", role, query],
    queryFn: () => listCommunityPeople(role, query),
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(
    () => applyDirectoryFilters(people.data ?? [], filters),
    [people.data, filters],
  );

  return {
    people: filtered,
    total: people.data?.length ?? 0,
    isLoading: people.isLoading,
    error: people.error as Error | null,
  };
};

export const useCommunityPerson = (username: string | undefined) => {
  const queryClient = useQueryClient();
  const person = useQuery({
    queryKey: ["community", "person", username],
    queryFn: () => getCommunityPerson(username!),
    enabled: Boolean(username),
  });

  // A view is counted once the full profile opens, never on a search card.
  useQuery({
    queryKey: ["community", "person-view", username],
    queryFn: async () => {
      const total = await recordProfileView(username!);
      void queryClient.invalidateQueries({ queryKey: ["community", "person", username] });
      return total;
    },
    enabled: Boolean(username && person.data),
    staleTime: Infinity,
  });

  return { person: person.data ?? null, isLoading: person.isLoading, error: person.error as Error | null };
};

/** Request state for every person on screen, from the real connection rows. */
export const useCommunityRequests = () => {
  const queryClient = useQueryClient();
  const { role, userId } = useAccount();
  const connections = useQuery({
    queryKey: ["community", "connections", userId ?? "anon"],
    queryFn: loadMyConnections,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

  const send = useMutation({
    mutationFn: (person: CommunityPerson) => sendCommunityRequest(role, person),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["community", "connections"] });
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const stateFor = (person: CommunityPerson): RequestState =>
    person.userId === userId
      ? "unavailable"
      : stateForPerson(connections.data ?? [], person.userId, person.acceptsRequests);

  return { myRole: role, myUserId: userId, stateFor, send };
};

export const useMyCommunityProfile = () =>
  useQuery({
    queryKey: ["community", "my-profile"],
    queryFn: loadMyCommunityProfile,
    staleTime: 60 * 1000,
  });
