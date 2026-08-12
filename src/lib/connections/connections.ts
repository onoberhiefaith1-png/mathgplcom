/**
 * Connections.
 *
 * A MathGPL account is independent: a teacher, student, parent or school owns
 * its identity permanently. Everything that links two accounts — a teacher
 * working with a school, a school enrolling a student, a parent following a
 * child — is a *connection*, requested by one side and accepted by the other.
 *
 * A connection never changes either account's MathGPL ID.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/accounts/roles";

export type Relation =
  | "school_teacher"
  | "school_student"
  | "teacher_student"
  | "parent_child"
  | "parent_teacher"
  | "parent_school";


export type ConnectionStatus = "pending" | "accepted" | "rejected" | "revoked";

export type Connection = {
  id: string;
  relation: Relation;
  status: ConnectionStatus;
  direction: "incoming" | "outgoing";
  counterpartUserId: string;
  counterpartName: string;
  /** Public username — the private MathGPL ID is never shown for other people. */
  counterpartUsername: string | null;
  counterpartRole: AppRole | null;
  orgId: string | null;
  orgName: string | null;
  message: string | null;
  createdAt: string;
};

export type ResolvedAccount = {
  userId: string;
  username: string;
  role: AppRole;
  displayName: string;
};

export type DiscoveredAccount = {
  userId: string;
  displayName: string;
  username: string | null;
  role: AppRole | null;
  activity: number;
  connectionStatus: ConnectionStatus | null;
  /** False when the account has switched new connection requests off. */
  acceptsRequests: boolean;
  /** Schools only. */
  orgId?: string;
  teachers?: number;
  students?: number;
};

export type ConnectionCounts = {
  schools: number;
  teachers: number;
  students: number;
  children: number;
  parents: number;
  pendingIncoming: number;
};

const RELATION_LABEL: Record<Relation, string> = {
  school_teacher: "Teacher at school",
  school_student: "Student at school",
  teacher_student: "Teacher and student",
  parent_child: "Parent and child",
  parent_teacher: "Parent and teacher",
  parent_school: "Parent and school",
  teacher_teacher: "Teachers",
  student_student: "Students",
  school_school: "Schools",
};

export const relationLabel = (relation: Relation) => RELATION_LABEL[relation] ?? "Connection";

/**
 * The database refuses a request with a short code word. A person needs a
 * sentence, so every refusal is translated here once.
 */
export const connectionError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/unknown_account/.test(message))
    return "That account isn't set up for connections yet. Ask them to sign in once, then try again.";
  if (/account_not_accepting_requests/.test(message))
    return "This account isn't accepting new connection requests at the moment.";
  if (/relation_not_valid_for_these_accounts/.test(message))
    return "These two account types can't be connected directly.";
  if (/invalid_target/.test(message)) return "That's your own account.";
  if (/school_workspace_not_found/.test(message))
    return "That school hasn't finished setting up its workspace yet.";
  if (/request_not_found|connection_not_found/.test(message))
    return "That request has already been answered.";
  if (/not_authenticated|JWT|401/.test(message))
    return "Your session has expired. Sign in again and try once more.";
  return message || "Something went wrong. Please try again.";
};

/**
 * What the recipient reads in their inbox. A request has a meaning, so the row
 * says who asked and what they asked for — never a bare relationship name.
 */
export const requestSentence = (connection: {
  relation: Relation;
  direction: "incoming" | "outgoing";
  counterpartName: string;
  counterpartUsername: string | null;
  counterpartRole: AppRole | null;
  orgName: string | null;
}): string => {
  const who = connection.counterpartUsername
    ? `@${connection.counterpartUsername}`
    : connection.counterpartName;
  const school = connection.orgName ?? connection.counterpartName;

  if (connection.direction === "outgoing") {
    switch (connection.relation) {
      case "school_teacher":
        return connection.counterpartRole === "teacher"
          ? `You invited ${who} to join ${school}.`
          : `You asked to work with ${school}.`;
      case "school_student":
        return connection.counterpartRole === "student"
          ? `You invited ${who} to join ${school}.`
          : `You asked to join ${school}.`;
      case "teacher_student":
        return `You asked to connect with ${who} as teacher and student.`;
      case "parent_child":
        return `You asked to be linked to ${who} as a parent.`;
      case "parent_teacher":
        return `You asked to connect with ${who} as parent and teacher.`;
      case "parent_school":
        return `You asked to connect with ${school} as a parent.`;
      default:
        return `You requested to connect with ${who}.`;
    }
  }

  switch (connection.relation) {
    case "school_teacher":
      return connection.counterpartRole === "school"
        ? `${school} has invited you to join their school workspace.`
        : `${who} has asked to work with your school.`;
    case "school_student":
      return connection.counterpartRole === "school"
        ? `${school} has invited you to join their school.`
        : `${who} has asked to join your school.`;
    case "teacher_student":
      return connection.counterpartRole === "teacher"
        ? `${who} has asked to work with you as your teacher.`
        : `${who} has asked you to be their teacher.`;
    case "parent_child":
      return connection.counterpartRole === "parent"
        ? `${who} has asked to be linked to your account as a parent.`
        : `${who} has asked you to be linked as their parent.`;
    case "parent_teacher":
      return `${who} has requested to connect with you as parent and teacher.`;
    case "parent_school":
      return connection.counterpartRole === "school"
        ? `${school} has requested to connect with you as a parent.`
        : `${who} has requested to connect with your school as a parent.`;
    default:
      return `${who} has requested to connect with you.`;
  }
};

/**
 * The wording of the request button. A relationship has a meaning, so the
 * button says what actually happens rather than a single generic phrase.
 */
export const requestActionLabel = (mine: AppRole | null, theirs: AppRole | null): string => {
  if (theirs === "school") {
    if (mine === "teacher") return "Request to work with school";
    if (mine === "student") return "Request to join school";
    if (mine === "parent") return "Connect to school";
  }
  if (theirs === "teacher") {
    if (mine === "school") return "Invite teacher";
    if (mine === "parent") return "Connect to teacher";
  }
  if (theirs === "student") {
    if (mine === "school") return "Invite student";
    if (mine === "parent") return "Connect to my child";
  }
  if (theirs === "parent") return "Connect to parent";
  return "Request to connect";
};

/**
 * The one relationship two account types can have. Account type decides the
 * relationship, so neither side can invent a link that does not exist.
 */
export const relationFor = (mine: AppRole | null, theirs: AppRole | null): Relation | null => {
  const pair = new Set([mine, theirs]);
  const both = (a: AppRole, b: AppRole) => pair.has(a) && pair.has(b) && mine !== theirs;
  if (mine && mine === theirs) {
    if (mine === "teacher") return "teacher_teacher";
    if (mine === "student") return "student_student";
    if (mine === "school") return "school_school";
    return null;
  }
  if (both("school", "teacher")) return "school_teacher";
  if (both("school", "student")) return "school_student";
  if (both("teacher", "student")) return "teacher_student";
  if (both("parent", "student")) return "parent_child";
  if (both("parent", "teacher")) return "parent_teacher";
  if (both("parent", "school")) return "parent_school";
  return null;
};

/** My permanent Share Code — an invitation code, never a password. */
export async function fetchMyShareCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_share_code");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function regenerateMyShareCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("regenerate_my_share_code");
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Turns Community discoverability on or off. Nothing private is exposed. */
export async function setGoLive(live: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_go_live", { _live: live });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Accepting requests is a *separate* setting from Go Live: an account may be
 * discoverable while refusing new requests, or stay private and still be
 * reachable by Share Code. The database refuses the request either way.
 */
export async function setAcceptsRequests(accept: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_accepts_requests", { _accept: accept });
  if (error) throw error;
  return Boolean(data);
}

export type Visibility = { live: boolean; acceptsRequests: boolean };

export async function fetchVisibility(userId: string): Promise<Visibility> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_live, accepts_requests")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { is_live?: boolean; accepts_requests?: boolean } | null;
  return { live: Boolean(row?.is_live), acceptsRequests: row?.accepts_requests !== false };
}

/** A share code identifies an account for a request. It can never sign anybody in. */
export async function resolveShareCode(code: string): Promise<ResolvedAccount | null> {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  const { data, error } = await supabase.rpc("resolve_share_code", { _code: cleaned });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { user_id: string; username: string; role: string; display_name: string }
    | undefined;
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    role: row.role as AppRole,
    displayName: row.display_name,
  };
}

export async function requestConnection(
  targetUserId: string,
  relation: Relation,
  message?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_connection", {
    _target_user_id: targetUserId,
    _relation: relation,
    _message: message?.trim() || undefined,
  });
  if (error) throw new Error(connectionError(error));
  return data as string;
}

export async function respondToConnection(connectionId: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc("respond_to_connection", {
    _connection_id: connectionId,
    _accept: accept,
  });
  if (error) throw new Error(connectionError(error));
  return data as string;
}

export async function revokeConnection(connectionId: string): Promise<string> {
  const { data, error } = await supabase.rpc("revoke_connection", { _connection_id: connectionId });
  if (error) throw new Error(connectionError(error));
  return data as string;
}

type ConnectionRow = {
  id: string;
  relation: string;
  status: string;
  direction: string;
  counterpart_user_id: string;
  counterpart_name: string;
  counterpart_username: string | null;
  counterpart_role: string | null;
  org_id: string | null;
  org_name: string | null;
  message: string | null;
  created_at: string;
};

const toConnection = (row: ConnectionRow): Connection => ({
  id: row.id,
  relation: row.relation as Relation,
  status: row.status as ConnectionStatus,
  direction: row.direction === "outgoing" ? "outgoing" : "incoming",
  counterpartUserId: row.counterpart_user_id,
  counterpartName: row.counterpart_name ?? "MathGPL account",
  counterpartUsername: row.counterpart_username,
  counterpartRole: (row.counterpart_role as AppRole | null) ?? null,
  orgId: row.org_id,
  orgName: row.org_name,
  message: row.message,
  createdAt: row.created_at,
});

export async function fetchConnections(status: ConnectionStatus | "all"): Promise<Connection[]> {
  const { data, error } = await supabase.rpc("my_connections", { _status: status });
  if (error) throw error;
  return ((data ?? []) as ConnectionRow[]).map(toConnection);
}

export async function fetchConnectionCounts(): Promise<ConnectionCounts> {
  const { data, error } = await supabase.rpc("my_connection_counts");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  return {
    schools: row?.["schools"] ?? 0,
    teachers: row?.["teachers"] ?? 0,
    students: row?.["students"] ?? 0,
    children: row?.["children"] ?? 0,
    parents: row?.["parents"] ?? 0,
    pendingIncoming: row?.["pending_incoming"] ?? 0,
  };
}

/** Community discovery: schools. Ranked by real activity, always searchable. */
export async function discoverSchools(query: string): Promise<DiscoveredAccount[]> {
  const { data, error } = await supabase.rpc("discover_schools", { _q: query });
  if (error) throw error;
  return ((data ?? []) as {
    org_id: string;
    owner_user_id: string;
    name: string;
    username: string | null;
    teachers: number;
    students: number;
    activity: number;
    connection_status: string | null;
    accepts_requests?: boolean;
  }[]).map((row) => ({
    orgId: row.org_id,
    userId: row.owner_user_id,
    displayName: row.name,
    username: row.username,
    role: "school" as AppRole,
    teachers: row.teachers,
    students: row.students,
    activity: row.activity,
    connectionStatus: (row.connection_status as ConnectionStatus | null) ?? null,
    acceptsRequests: row.accepts_requests !== false,
  }));
}

/** Community discovery: teachers, students and parents, only while they are live. */
export async function discoverAccounts(
  role: "teacher" | "student" | "parent",
  query: string,
): Promise<DiscoveredAccount[]> {
  const { data, error } = await supabase.rpc("discover_accounts", { _role: role, _q: query });
  if (error) throw error;
  return ((data ?? []) as {
    user_id: string;
    display_name: string;
    username: string | null;
    role: string | null;
    activity: number;
    connection_status: string | null;
    accepts_requests?: boolean;
  }[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    username: row.username,
    role: (row.role as AppRole | null) ?? null,
    activity: row.activity,
    connectionStatus: (row.connection_status as ConnectionStatus | null) ?? null,
    acceptsRequests: row.accepts_requests !== false,
  }));
}

/* ------------------------------------------------------------------ *
 * Codes — the second route into a relationship.
 *
 * Discovery (Go Live) is one way to find an account; a code is the other. A
 * code identifies an account so a request can be sent to it. It is never a
 * password, it never signs anybody in and resolving one establishes nothing.
 * ------------------------------------------------------------------ */

export type SchoolCode = { orgId: string; name: string; code: string };

/** The signed-in school's own School Code. Null for every other account type. */
export async function fetchMySchoolCode(): Promise<SchoolCode | null> {
  const { data, error } = await supabase.rpc("my_school_code");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { org_id: string; name: string; code: string }
    | undefined;
  if (!row?.code) return null;
  return { orgId: row.org_id, name: row.name ?? "My school", code: row.code };
}

export async function regenerateSchoolCode(orgId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("regenerate_school_code", { _org_id: orgId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export type ResolvedCode = ResolvedAccount & {
  /** Present when the code belonged to a school. */
  orgId: string | null;
  orgName: string | null;
  matched: "school_code" | "mathgpl_id" | "share_code";
  /** False when the account has switched new connection requests off. */
  acceptsRequests: boolean;
};

/**
 * One lookup for every code a person may be handed: a School Code, a permanent
 * MathGPL ID (TCH/…, STU/…, SC/…, PAR/…) or a personal Share Code. Only the
 * name, account type and permanent ID come back, so the sender can confirm who
 * they are contacting before a request exists.
 */
export async function resolveAccountCode(code: string): Promise<ResolvedCode | null> {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  const { data, error } = await supabase.rpc("resolve_account_code", { _code: cleaned });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        user_id: string;
        username: string | null;
        role: string;
        display_name: string;
        org_id: string | null;
        org_name: string | null;
        matched: string;
        accepts_requests?: boolean;
      }
    | undefined;
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username ?? "mathgpl",
    role: row.role as AppRole,
    displayName: row.display_name,
    orgId: row.org_id,
    orgName: row.org_name,
    matched: (row.matched as ResolvedCode["matched"]) ?? "share_code",
    acceptsRequests: row.accepts_requests !== false,
  };
}

/** How the code was recognised, in words the sender understands. */
export const matchedCodeLabel = (matched: ResolvedCode["matched"]): string =>
  matched === "school_code" ? "School Code" : matched === "mathgpl_id" ? "MathGPL ID" : "Share Code";
