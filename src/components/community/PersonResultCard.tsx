/**
 * A Community discovery card.
 *
 * This is a *preview*, not a database row: cover media, face, name, role line
 * and at most four proof points that answer "why would I open this profile?".
 * Full professional detail belongs on the public space, one click away.
 */
import { Link } from "@/lib/router-compat";
import { MapPin, Play } from "lucide-react";
import { ROLE_PLURAL, type CommunityPerson } from "@/lib/community/people";
import { requestStateLabel, type RequestState } from "@/lib/community/requests";
import { useCommunityMediaUrl } from "@/lib/community/media";

const compact = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : String(value);

const ROLE_LINE: Record<string, string> = {
  teacher: "Mathematics teacher",
  school: "School",
  student: "Student",
  parent: "Parent",
};

/** At most four, role-appropriate, always the strongest first. */
const proofPoints = (person: CommunityPerson): { label: string; value: string }[] => {
  const { metrics, professional: pro } = person;
  const points: { label: string; value: string }[] = [];

  if (person.roleKind === "school") {
    if (metrics.students > 0) points.push({ label: "Students", value: `${compact(metrics.students)}+` });
    if (pro.schoolType) points.push({ label: "Type", value: pro.schoolType });
  } else {
    if (metrics.students > 0) points.push({ label: "Students taught", value: `${compact(metrics.students)}+` });
    if (person.yearsExperience) points.push({ label: "Experience", value: `${person.yearsExperience} yrs` });
  }

  if (metrics.shared > 0) points.push({ label: "Shared", value: `${compact(metrics.shared)} resources` });
  if (metrics.live > 0) points.push({ label: "Live rooms", value: compact(metrics.live) });
  if (points.length < 4 && metrics.likes > 0) {
    points.push({ label: "Appreciations", value: compact(metrics.likes) });
  }

  return points.slice(0, 4);
};

const PersonResultCard = ({
  person,
  state,
  onRequest,
  requesting,
}: {
  person: CommunityPerson;
  state: RequestState;
  onRequest?: (person: CommunityPerson) => void;
  requesting?: boolean;
}) => {
  const initials = (person.displayName || person.username).slice(0, 2).toUpperCase();
  const avatarSrc = useCommunityMediaUrl(person.avatarUrl);
  const coverSrc = useCommunityMediaUrl(person.coverUrl);
  const points = proofPoints(person);
  const subjects = (person.professional.subjects ?? person.professional.interests ?? []).slice(0, 3);
  const roleLine =
    person.headline ||
    (person.roleKind ? ROLE_LINE[person.roleKind] : null) ||
    (person.roleKind ? ROLE_PLURAL[person.roleKind] : "MathGPL member");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-dash-navy/40 shadow-xl backdrop-blur transition hover:border-dash-gold/50">
      {/* Cover media — the first reason to look twice. */}
      <div className="relative h-28 w-full overflow-hidden bg-[linear-gradient(120deg,hsl(222_47%_20%),hsl(222_44%_28%))]">
        {coverSrc &&
          (person.coverKind === "video" ? (
            <video
              src={coverSrc}
              muted
              loop
              playsInline
              autoPlay
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <img
              src={coverSrc}
              alt={`${person.displayName} cover`}
              loading="lazy"
              className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03]"
            />
          ))}
        {person.introVideoUrl && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            <Play className="h-3 w-3" /> Intro
          </span>
        )}
      </div>

      <div className="-mt-8 flex flex-1 flex-col gap-3 px-4 pb-4">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={`${person.displayName} profile photo`}
            loading="lazy"
            className="h-16 w-16 rounded-2xl border-2 border-dash-navy object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dash-navy bg-dash-gold/15 text-lg font-semibold text-dash-gold shadow-lg">
            {initials}
          </div>
        )}

        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-dash-surface">{person.displayName}</h3>
          <p className="truncate text-sm text-dash-surface/75">{roleLine}</p>
          {(person.location || person.country) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-dash-surface/55">
              <MapPin className="h-3 w-3" />
              {[person.location, person.country].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>

        {points.length > 0 && (
          <dl className="grid grid-cols-2 gap-2">
            {points.map((point) => (
              <div key={point.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-surface/50">
                  {point.label}
                </dt>
                <dd className="truncate text-sm font-semibold text-dash-surface">{point.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {subjects.length > 0 && (
          <p className="truncate text-xs text-dash-surface/60">{subjects.join(" • ")}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            to={`/community/people/${person.username}`}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center rounded-full bg-dash-gold px-4 text-xs font-semibold uppercase tracking-[0.12em] text-dash-navy transition hover:brightness-110"
          >
            View profile
          </Link>
          {onRequest && (
            <button
              type="button"
              disabled={state !== "none" || requesting}
              onClick={() => onRequest(person)}
              className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-white/20 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-dash-surface transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {requesting ? "Sending…" : requestStateLabel(state)}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default PersonResultCard;
