/**
 * Community requests reuse the platform connection system.
 *
 * A request raised from a Community card is the *same* request a teacher,
 * school, parent or student already answers in their requests inbox — there is
 * no second, parallel request system.
 */
import {
  fetchConnections,
  relationFor,
  requestActionLabel,
  requestConnection,
  type Connection,
  type ConnectionStatus,
} from "@/lib/connections/connections";
import type { AppRole } from "@/lib/accounts/roles";
import type { CommunityRoleKind } from "./people";

export type RequestState = "none" | "pending" | "accepted" | "declined" | "unavailable";

export const requestStateLabel = (state: RequestState): string =>
  ({
    none: "Request",
    pending: "Pending",
    accepted: "Connected",
    declined: "Declined",
    unavailable: "Not accepting requests",
  })[state];

/** Maps live connection rows to the button state for one person. */
export const stateForPerson = (
  connections: Connection[],
  targetUserId: string,
  acceptsRequests: boolean,
): RequestState => {
  const mine = connections.filter((c) => c.counterpartUserId === targetUserId);
  const has = (status: ConnectionStatus) => mine.some((c) => c.status === status);
  if (has("accepted")) return "accepted";
  if (has("pending")) return "pending";
  if (has("rejected")) return "declined";
  if (!acceptsRequests) return "unavailable";
  return "none";
};

export const communityRequestLabel = (
  myRole: AppRole | null,
  theirRole: CommunityRoleKind | null,
): string | null => {
  if (!myRole || !theirRole) return null;
  if (!relationFor(myRole, theirRole as AppRole)) return null;
  return requestActionLabel(myRole, theirRole as AppRole);
};

export const sendCommunityRequest = async (
  myRole: AppRole | null,
  person: { userId: string; roleKind: CommunityRoleKind | null },
  message?: string,
): Promise<string> => {
  const relation = relationFor(myRole, (person.roleKind ?? null) as AppRole | null);
  if (!relation) throw new Error("These two account types can't be connected directly.");
  return requestConnection(person.userId, relation, message);
};

export const loadMyConnections = () => fetchConnections("all");
