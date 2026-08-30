/**
 * One directory page for Teachers, Schools, Students and Parents.
 *
 * The four groups are first-class citizens of Community, so they share one
 * grid and one request pipeline; only the filters change per group.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import CommunityShell from "@/components/community/CommunityShell";
import PersonResultCard from "@/components/community/PersonResultCard";
import { ROLE_PLURAL, type CommunityPerson, type CommunityRoleKind, type DirectoryFilters } from "@/lib/community/people";
import { useCommunityPeople, useCommunityRequests } from "@/lib/community/usePeople";

type FilterField = { key: keyof DirectoryFilters; label: string; placeholder: string; numeric?: boolean };

const FILTERS: Record<CommunityRoleKind, FilterField[]> = {
  teacher: [
    { key: "subject", label: "Subject", placeholder: "Mathematics" },
    { key: "level", label: "Level / curriculum", placeholder: "GCSE" },
    { key: "location", label: "Location", placeholder: "United Kingdom" },
    { key: "qualification", label: "Qualification", placeholder: "MA Education" },
    { key: "minYears", label: "Minimum experience (years)", placeholder: "5", numeric: true },
  ],
  school: [
    { key: "location", label: "Location", placeholder: "Lagos" },
    { key: "schoolType", label: "School type", placeholder: "Secondary" },
    { key: "subject", label: "Subject", placeholder: "Mathematics" },
    { key: "level", label: "Level", placeholder: "JSS" },
  ],
  student: [
    { key: "interest", label: "Learning interest", placeholder: "Algebra" },
    { key: "level", label: "Level", placeholder: "Year 5" },
    { key: "subject", label: "Subject", placeholder: "Mathematics" },
  ],
  parent: [
    { key: "location", label: "Location", placeholder: "Manchester" },
    { key: "interest", label: "Educational interest", placeholder: "Primary mathematics" },
  ],
};

const SUBTITLE: Record<CommunityRoleKind, string> = {
  teacher: "Find a mathematics teacher by subject, level, location, qualification and experience.",
  school: "Find schools by location, type, subjects and levels, and connect with them.",
  student:
    "Students appear here only with what they have chosen to make public — never their location or personal details.",
  parent: "Parents discovering teachers, schools and educational resources.",
};

const CommunityDirectoryPage = ({ role }: { role: CommunityRoleKind }) => {
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState<Record<string, string>>({});

  const filters = useMemo<DirectoryFilters>(() => {
    const next: DirectoryFilters = {};
    for (const field of FILTERS[role]) {
      const value = raw[field.key as string]?.trim();
      if (!value) continue;
      if (field.numeric) next.minYears = Number(value) || undefined;
      else (next as Record<string, string>)[field.key as string] = value;
    }
    return next;
  }, [raw, role]);

  const { people, total, isLoading, error } = useCommunityPeople(role, query, filters);
  const { stateFor, send } = useCommunityRequests();

  const request = (person: CommunityPerson) =>
    send.mutate(person, {
      onSuccess: () => toast.success(`Request sent to ${person.displayName}.`),
      onError: (mutationError) =>
        toast.error(mutationError instanceof Error ? mutationError.message : "Could not send that request."),
    });

  return (
    <CommunityShell
      active={`/community/${role === "school" ? "schools" : `${role}s`}`}
      title={ROLE_PLURAL[role]}
      subtitle={SUBTITLE[role]}
      showSearch={false}
    >
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-dash-navy/30 p-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/55">
              Search {ROLE_PLURAL[role].toLowerCase()}
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, headline or keyword"
              className="mt-1.5 min-h-[42px] w-full rounded-xl border border-white/15 bg-dash-navy/50 px-3 text-sm outline-none placeholder:text-dash-surface/40 focus:border-dash-gold/60"
            />
          </div>

          {FILTERS[role].map((field) => (
            <div key={field.key as string}>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/55">
                {field.label}
              </label>
              <input
                value={raw[field.key as string] ?? ""}
                inputMode={field.numeric ? "numeric" : "text"}
                onChange={(event) =>
                  setRaw((prev) => ({ ...prev, [field.key as string]: event.target.value }))
                }
                placeholder={field.placeholder}
                className="mt-1.5 min-h-[42px] w-full rounded-xl border border-white/15 bg-dash-navy/50 px-3 text-sm outline-none placeholder:text-dash-surface/40 focus:border-dash-gold/60"
              />
            </div>
          ))}

          {(query || Object.values(raw).some(Boolean)) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRaw({});
              }}
              className="min-h-[38px] w-full rounded-full border border-white/20 text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface/80"
            >
              Clear filters
            </button>
          )}
        </aside>

        <section>
          <p className="pb-3 text-xs text-dash-surface/55">
            {isLoading ? "Loading…" : `${people.length} of ${total} listed ${ROLE_PLURAL[role].toLowerCase()}`}
          </p>

          {error && (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error.message}
            </p>
          )}

          {!isLoading && !error && people.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-6 text-sm text-dash-surface/70">
              Nobody matches this search yet. {ROLE_PLURAL[role]} appear here once they switch their Community
              profile on from their own workspace.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((person) => (
              <PersonResultCard
                key={person.userId}
                person={person}
                state={stateFor(person)}
                onRequest={request}
                requesting={send.isPending && send.variables?.userId === person.userId}
              />
            ))}
          </div>
        </section>
      </div>
    </CommunityShell>
  );
};

export default CommunityDirectoryPage;
