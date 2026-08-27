import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/accounts/roles";
import {
  AUDIENCE_LABEL,
  SENDER_AUDIENCES,
  canFilterByRegion,
  type AudienceKind,
  type AudienceRequest,
} from "@/lib/notifications/audience";
import { listSchoolsForAudience, previewAudience } from "@/lib/notifications/notifications.functions";

/**
 * Efficient audience selection: pick a preset, narrow it by school or region,
 * then add or remove individual people. Nobody has to tick 248 names.
 */
const AudiencePicker = ({
  role,
  value,
  onChange,
}: {
  role: AppRole;
  value: AudienceRequest;
  onChange: (next: AudienceRequest) => void;
}) => {
  const [search, setSearch] = useState("");
  const preview = useServerFn(previewAudience);
  const loadSchools = useServerFn(listSchoolsForAudience);

  const kinds = SENDER_AUDIENCES[role];
  const schools = useQuery({
    queryKey: ["notifications", "audience-schools"],
    queryFn: () => loadSchools(),
    enabled: canFilterByRegion(role),
    staleTime: 5 * 60 * 1000,
  });

  const resolved = useQuery({
    queryKey: ["notifications", "audience", value],
    queryFn: () => preview({ data: { audience: value } }),
    staleTime: 30_000,
  });

  const people = resolved.data?.people ?? [];
  const excluded = new Set(value.excludeUserIds ?? []);
  const included = new Set(value.includeUserIds ?? []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q))
      : people;
    return list.slice(0, 60);
  }, [people, search]);

  const regions = useMemo(
    () => [...new Set(people.map((p) => p.region).filter((r): r is string => !!r))].sort(),
    [people],
  );

  const setKind = (kind: AudienceKind) =>
    onChange({ kind, orgIds: [], region: null, includeUserIds: [], excludeUserIds: [] });

  const toggleExcluded = (userId: string) => {
    const next = new Set(excluded);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange({ ...value, excludeUserIds: [...next] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setKind(kind)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              value.kind === kind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary"
            }`}
          >
            {AUDIENCE_LABEL[kind]}
          </button>
        ))}
      </div>

      {canFilterByRegion(role) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Region</span>
          <select
            value={value.region ?? ""}
            onChange={(event) => onChange({ ...value, region: event.target.value || null })}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">Everywhere</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          {(schools.data?.schools ?? []).length > 0 && value.kind !== "everyone" && (
            <>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">School</span>
              <select
                value={(value.orgIds ?? [])[0] ?? ""}
                onChange={(event) =>
                  onChange({ ...value, orgIds: event.target.value ? [event.target.value] : [] })
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">All schools</option>
                {(schools.data?.schools ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-card-foreground">
            <span className="font-semibold">{resolved.data?.count ?? 0}</span> recipient
            {(resolved.data?.count ?? 0) === 1 ? "" : "s"}
            {excluded.size > 0 && <span className="text-muted-foreground"> · {excluded.size} removed</span>}
          </p>
          {excluded.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...value, excludeUserIds: [] })}>
              Reset removals
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this audience…"
            aria-label="Search this audience"
            className="w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
          />
        </div>

        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
          {filtered.map((person) => {
            const removed = excluded.has(person.userId);
            return (
              <li
                key={person.userId}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                  removed ? "opacity-50" : ""
                }`}
              >
                <span className="truncate text-foreground">
                  {person.name}
                  {person.role && <span className="text-muted-foreground"> · {person.role}</span>}
                  {person.region && <span className="text-muted-foreground"> · {person.region}</span>}
                  {included.has(person.userId) && <span className="text-muted-foreground"> · added</span>}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExcluded(person.userId)}
                  aria-label={removed ? `Add ${person.name} back` : `Remove ${person.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  {removed ? <Plus className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              {resolved.isLoading ? "Resolving audience…" : "Nobody matches this audience yet."}
            </li>
          )}
        </ul>
      </div>

      {resolved.data && resolved.data.count > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Only people this account is related to can be reached.
        </p>
      )}
    </div>
  );
};

export default AudiencePicker;
