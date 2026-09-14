import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SURFACES } from "@/lib/slate/surfaces";
import {
  deleteGame,
  dismissLocalGames,
  importLocalGames,
  listGames,
  listLocalGames,
  saveGame,
} from "@/lib/slate/storage";
import { makeGame } from "@/lib/slate/defaults";
import type { Game } from "@/lib/slate/types";
import cavern from "@/assets/slate/backgrounds/cavern.jpg";
import frost from "@/assets/slate/backgrounds/frost.jpg";
import keep from "@/assets/slate/backgrounds/keep.jpg";


const PRESET_BACKGROUNDS = [
  { id: "cavern", label: "Cavern", src: cavern },
  { id: "frost", label: "Frost", src: frost },
  { id: "keep", label: "Keep", src: keep },
];

const LINE_OPTIONS = [5, 10, 15, 20, 30, 50];

export default function GameSlateGalleryPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [surfaceId, setSurfaceId] = useState(SURFACES[0]!.id);
  const [lines, setLines] = useState(10);
  const [background, setBackground] = useState<{ src: string; kind: "image" | "video" }>({
    src: cavern,
    kind: "image",
  });

  const [pending, setPending] = useState(0);

  useEffect(() => {
    listGames().then(setGames);
    setPending(listLocalGames().length);
  }, []);

  const create = async () => {
    const game = makeGame({
      name,
      topic,
      subtopic,
      surfaceId,
      lines,
      background: { ...background, scale: 1, x: 0, y: 0, opacity: 1 },
    });
    await saveGame(game);
    navigate({ to: "/game/slate/$gameId", params: { gameId: game.id } });
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () =>
      setBackground({
        src: String(reader.result),
        kind: file.type.startsWith("video") ? "video" : "image",
      });
    reader.readAsDataURL(file);
  };

  return (
    <main className="min-h-screen bg-[#0b0906] text-amber-50">
      <div
        className="relative border-b border-amber-200/10 bg-cover bg-center"
        style={{ backgroundImage: `url(${cavern})` }}
      >
        <div className="bg-black/70 px-6 py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-200/70">MathGPL Game Slate</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold uppercase leading-tight sm:text-5xl">
            Make Mathematics Playable
          </h1>
          <p className="mt-3 text-lg font-semibold text-amber-100/90">Write. Solve. Win.</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/60">
            Create a game where students write mathematics directly onto the physical surface,
            solve each challenge, and earn rewards as they progress.
          </p>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-7 rounded border border-amber-300/60 bg-amber-300/15 px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-300/25"
            >
              Create game
            </button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {creating ? (
          <section className="mb-12 rounded-xl border border-amber-200/15 bg-[#130e08]/80 p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-amber-200/70">New game</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-[11px] uppercase tracking-wider text-amber-100/50">
                Game name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Solving Linear Equations"
                  className="w-full rounded border border-amber-200/20 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-amber-50 outline-none focus:border-amber-300/60"
                />
              </label>
              <label className="space-y-1.5 text-[11px] uppercase tracking-wider text-amber-100/50">
                Topic
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Algebra"
                  className="w-full rounded border border-amber-200/20 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-amber-50 outline-none focus:border-amber-300/60"
                />
              </label>
              <label className="space-y-1.5 text-[11px] uppercase tracking-wider text-amber-100/50">
                Subtopic
                <input
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  placeholder="Brackets"
                  className="w-full rounded border border-amber-200/20 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-amber-50 outline-none focus:border-amber-300/60"
                />
              </label>
            </div>

            <div className="mt-7 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-amber-100/50">Background</span>
              <div className="flex flex-wrap items-center gap-3">
                {PRESET_BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBackground({ src: b.src, kind: "image" })}
                    className={`h-14 w-24 rounded border bg-cover bg-center ${
                      background.src === b.src ? "border-amber-300" : "border-amber-200/15"
                    }`}
                    style={{ backgroundImage: `url(${b.src})` }}
                    title={b.label}
                  />
                ))}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                  className="text-xs text-amber-100/60 file:mr-3 file:rounded file:border file:border-amber-200/25 file:bg-transparent file:px-3 file:py-1.5 file:text-amber-100"
                />
              </div>
            </div>

            <div className="mt-7 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-amber-100/50">Surface</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSurfaceId(s.id)}
                    className={`overflow-hidden rounded border text-left ${
                      surfaceId === s.id
                        ? "border-amber-300 ring-1 ring-amber-300/50"
                        : "border-amber-200/15 hover:border-amber-200/40"
                    }`}
                  >
                    <span
                      className="block h-16 w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${s.texture})` }}
                    />
                    <span className="block px-2 py-1.5 text-[11px] text-amber-100/75">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-amber-100/50">
                Number of lines
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {LINE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setLines(n)}
                    className={`rounded border px-4 py-1.5 text-sm ${
                      lines === n
                        ? "border-amber-300 bg-amber-300/15 text-amber-100"
                        : "border-amber-200/15 text-amber-100/60 hover:bg-amber-200/10"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={lines}
                  onChange={(e) => setLines(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 rounded border border-amber-200/20 bg-black/40 px-3 py-1.5 text-sm text-amber-50 outline-none"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-2">
              <button
                onClick={create}
                className="rounded border border-amber-300/60 bg-amber-300/20 px-5 py-2 text-xs uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-300/30"
              >
                Create game
              </button>
              <button
                onClick={() => setCreating(false)}
                className="rounded border border-amber-200/20 px-5 py-2 text-xs uppercase tracking-[0.22em] text-amber-100/60 hover:bg-amber-200/10"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {pending > 0 ? (
          <section className="mb-8 rounded-xl border border-amber-200/20 bg-[#130e08]/70 p-5">
            <p className="text-sm text-amber-100/80">
              {pending} game{pending === 1 ? "" : "s"} were saved only in this browser. Bring them
              into your account so they are safe and can be used on any device.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  await importLocalGames();
                  setPending(0);
                  setGames(await listGames());
                }}
                className="rounded border border-amber-300/60 bg-amber-300/20 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-amber-100"
              >
                Bring them in
              </button>
              <button
                onClick={() => {
                  dismissLocalGames();
                  setPending(0);
                }}
                className="rounded border border-amber-200/20 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-amber-100/60"
              >
                Not now
              </button>
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-xs uppercase tracking-[0.25em] text-amber-200/60">Saved slates</h2>
          {games.length === 0 ? (
            <p className="mt-4 text-sm text-amber-100/40">
              Nothing saved yet. Create a game to begin.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => {
                const s = SURFACES.find((x) => x.id === g.surfaceId) ?? SURFACES[0]!;
                return (
                  <li
                    key={g.id}
                    className="overflow-hidden rounded-lg border border-amber-200/15 bg-[#130e08]/70"
                  >
                    <button
                      onClick={() =>
                        navigate({ to: "/game/slate/$gameId", params: { gameId: g.id } })
                      }
                      className="block w-full text-left"
                    >
                      <span
                        className="block h-20 w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${s.texture})` }}
                      />
                      <span className="block px-4 py-3">
                        <span className="block truncate text-sm text-amber-50">{g.name}</span>
                        <span className="block truncate text-[11px] uppercase tracking-wider text-amber-100/40">
                          {s.label} · {g.slots.length} lines
                        </span>
                      </span>
                    </button>
                    <div className="flex justify-end border-t border-amber-200/10 px-3 py-2">
                      <button
                        onClick={async () => {
                          await deleteGame(g.id);
                          setGames(await listGames());
                        }}
                        className="text-[11px] uppercase tracking-wider text-red-200/60 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
