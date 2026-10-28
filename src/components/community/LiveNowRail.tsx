/**
 * Live Now — who is teaching this minute.
 *
 * Live is the most time-sensitive thing in Community, so it sits at the very
 * top of the network page and refreshes itself.
 */
import { Link } from "@/lib/router-compat";
import { Radio, Users } from "lucide-react";
import { useLiveNow } from "@/lib/community/live";

const LiveNowRail = () => {
  const { rooms, isLoading } = useLiveNow();

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
        </span>
        Live now
      </h2>

      {isLoading ? (
        <p className="text-sm text-dash-surface/60">Checking who is live…</p>
      ) : rooms.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
          No public teaching rooms are live at the moment.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article
              key={room.sessionId}
              className="rounded-2xl border border-red-400/25 bg-dash-navy/45 p-4"
            >
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
                <Radio className="h-3.5 w-3.5" /> Live
              </p>
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-dash-surface">{room.title}</h3>
              {room.subject && <p className="text-xs text-dash-surface/60">{room.subject}</p>}
              <p className="mt-2 flex items-center gap-3 text-xs text-dash-surface/55">
                {room.ownerUsername ? (
                  <Link to={`/community/people/${room.ownerUsername}`} className="hover:text-dash-gold">
                    {room.ownerName}
                  </Link>
                ) : (
                  <span>{room.ownerName}</span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {room.audienceCount}
                </span>
              </p>
              {room.shareCode && (
                <Link
                  to={`/live/join/${room.shareCode}`}
                  className="mt-3 inline-flex min-h-[38px] items-center rounded-full bg-dash-gold px-4 text-xs font-semibold text-dash-navy transition hover:brightness-110"
                >
                  Join the room
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default LiveNowRail;
