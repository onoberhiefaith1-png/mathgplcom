import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Gamepad2, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/accounts/useAccount";
import { makeGame } from "@/lib/slate/defaults";
import { canShareGameToLibrary, copyGameTemplate, templateShareAction } from "@/lib/slate/library";
import { listStudentGameAssignments, type StudentGameAssignment } from "@/lib/slate/gameAssignments";
import { deleteGame, listGames, listLibraryGames, saveGameResult, setGameLibrary } from "@/lib/slate/storage";
import { duplicateTemplateMedia } from "@/lib/slate/templateMediaCopy";
import LibraryShelf from "@/components/library/LibraryShelf";
import { SURFACES } from "@/lib/slate/surfaces";
import type { Game } from "@/lib/slate/types";
import cavern from "@/assets/slate/backgrounds/cavern.jpg";
import frost from "@/assets/slate/backgrounds/frost.jpg";
import keep from "@/assets/slate/backgrounds/keep.jpg";

const BACKGROUNDS = [
  { label: "Cavern", src: cavern },
  { label: "Frost", src: frost },
  { label: "Keep", src: keep },
];

type AssignedImagine = StudentGameAssignment & { classId: string };

export default function ImagineHomePage() {
  const navigate = useNavigate();
  const { role, roles, userId, isLoading: accountLoading } = useAccount();
  const [games, setGames] = useState<Game[]>([]);
  const [library, setLibrary] = useState<Game[]>([]);
  const [assigned, setAssigned] = useState<AssignedImagine[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [surfaceId, setSurfaceId] = useState(SURFACES[0]?.id ?? "plain");
  const [lines, setLines] = useState(10);
  const [background, setBackground] = useState(BACKGROUNDS[0]?.src ?? cavern);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [sensorVisible, setSensorVisible] = useState(true);
  const [growWithContent, setGrowWithContent] = useState(true);
  const [finish, setFinish] = useState<"clean" | "framed" | "luminous">("framed");
  const [textTreatment, setTextTreatment] = useState<"flat" | "raised" | "engraved">("raised");
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [textColour, setTextColour] = useState("#173f91");
  const [holdsAccessCode, setHoldsAccessCode] = useState(false);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (accountLoading) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        if (role === "student") {
          const { data } = await supabase.from("class_members").select("class_id");
          const classIds = [...new Set(((data ?? []) as { class_id: string }[]).map((row) => row.class_id))];
          const [rows, samples] = await Promise.all([
            Promise.all(classIds.map(async (classId) =>
              (await listStudentGameAssignments(classId)).map((row) => ({ ...row, classId })),
            )),
            listLibraryGames(),
          ]);
          if (active) {
            setAssigned(rows.flat());
            setLibrary(samples);
          }
        } else {
          const [rows, samples] = await Promise.all([listGames(), listLibraryGames()]);
          if (active) {
            setGames(rows);
            setLibrary(samples);
          }
        }
        const { data: authorRows } = await supabase.rpc("library_game_authors");
        if (active && authorRows) {
          const next: Record<string, string> = {};
          for (const row of authorRows) next[row.owner_id] = row.author;
          setAuthors(next);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [accountLoading, role]);

  useEffect(() => {
    if (accountLoading || !userId) return;
    let active = true;
    void supabase.rpc("can_share_game_library").then(({ data }) => {
      if (active) setHoldsAccessCode(data === true);
    });
    return () => { active = false; };
  }, [accountLoading, userId]);

  const teacher = role === "teacher" || role === "platform_owner" || role === "co_admin";
  const isAdmin = role === "platform_owner" || role === "co_admin" || roles.includes("platform_owner") || roles.includes("co_admin");
  const canShare = canShareGameToLibrary({ isAdmin, holdsAccessCode });

  const refreshLibrary = async () => {
    const [rows, samples] = await Promise.all([listGames(), listLibraryGames()]);
    setGames(rows);
    setLibrary(samples);
    const { data } = await supabase.rpc("library_game_authors");
    if (data) {
      const next: Record<string, string> = {};
      for (const row of data) next[row.owner_id] = row.author;
      setAuthors(next);
    }
  };

  const publish = async (game: Game) => {
    const result = await setGameLibrary(game.id, true);
    if (!result.ok) {
      toast.error(result.message ?? "This game could not be published.");
      return;
    }
    toast.success(`${game.name} is on the template shelf. The shelf shows your latest edit. A teacher who copies it keeps that snapshot.`);
    await refreshLibrary();
  };

  const unpublish = async (game: Game) => {
    const result = await setGameLibrary(game.id, false);
    if (!result.ok) {
      toast.error(result.message ?? "This sample could not be removed.");
      return;
    }
    toast.success(`${game.name} is no longer a template.`);
    await refreshLibrary();
  };

  const copyTemplate = async (game: Game) => {
    if (!userId) return;
    const copy = copyGameTemplate(game, { id: crypto.randomUUID(), ownerId: userId });
    const prepared = await duplicateTemplateMedia(copy, game, userId);
    const result = await saveGameResult(prepared);
    if (!result.ok) {
      toast.error(result.message ?? "A copy could not be made.");
      return;
    }
    const pending = prepared.settings.templateMedia?.pending.length ?? 0;
    toast.success(pending > 0
      ? "Copied to My games. Some uploaded files could not be duplicated into your account. Those files keep their original path and stop playing if the template is unshared or the file is deleted."
      : "Copied to My games. Uploaded video and sound were copied into your account. It has no questions yet.");
    await refreshLibrary();
  };
  const selectedSurface = useMemo(() => SURFACES.find((surface) => surface.id === surfaceId) ?? SURFACES[0], [surfaceId]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const game = makeGame({
      name, topic, subtopic, surfaceId, lines,
      background: { src: background, kind: "image", scale: 1, x: 0, y: 0, opacity: backgroundOpacity },
    });
    game.settings = {
      ...game.settings,
      numbers: { ...game.settings.numbers, visible: lineNumbers },
      imagine: { sensorVisible, growWithContent, finish, textTreatment },
      text: { ...game.settings.text, colour: textColour },
    };
    const result = await saveGameResult(game);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? "Game could not be created.");
      return;
    }
    navigate({ to: "/game/slate/$gameId", params: { gameId: game.id } });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-5 py-8 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">MathGPL Game</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Smartboard speed. Game energy.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Your mathematics games as a fast 2D experience: background, writing surface, Floating Numbers and independent rewards.</p>
          </div>
          {teacher ? <Button onClick={() => setCreating((value) => !value)}><Plus /> New Game</Button> : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        <LibraryShelf
          eyebrow="Game templates"
          title="Game templates"
          description="Open a template to see the author’s latest version. Copy to my games takes a snapshot — writing surface, rewards, sound, text and progress style, and no questions. Later edits to the template do not change your copy."
          presentation="covers"
          items={library.map((game) => {
            const surface = SURFACES.find((item) => item.id === game.surfaceId);
            const src = game.background?.src ?? "";
            const cover = /^(https?:|data:|blob:|\/)/.test(src) ? src : surface?.texture;
            return {
              id: game.id,
              title: game.name,
              author: (game.ownerId && authors[game.ownerId]) || "MathGPL teacher",
              detail: [game.topic, game.subtopic].filter(Boolean).join(" · ") || "Mathematics",
              cover,
            };
          })}
          empty={canShare ? "No templates yet. Share one of your games and it will stand on this shelf." : "No templates yet."}
          onSelect={() => undefined}
          onOpen={(id) => navigate({ to: "/game/play/$gameId", params: { gameId: id } })}
          renderActions={(item) => {
            const game = library.find((row) => row.id === item.id);
            if (!game) return null;
            return (
              <>
                <Button size="sm" className="min-h-11 h-auto whitespace-normal" onClick={() => navigate({ to: "/game/play/$gameId", params: { gameId: game.id } })}><Play /> Play</Button>
                {teacher ? <Button size="sm" variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={() => void copyTemplate(game)}>Copy to my games</Button> : null}
              </>
            );
          }}
        />
        {creating && teacher ? (
          <section className="mb-8 border-b border-border pb-8">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="new-imagine-name">Name</Label><Input id="new-imagine-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Solving linear equations" /></div>
              <div className="space-y-2"><Label htmlFor="new-imagine-topic">Topic</Label><Input id="new-imagine-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Algebra" /></div>
              <div className="space-y-2"><Label htmlFor="new-imagine-subtopic">Subtopic</Label><Input id="new-imagine-subtopic" value={subtopic} onChange={(event) => setSubtopic(event.target.value)} placeholder="Brackets" /></div>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">
              <div className="space-y-2"><Label htmlFor="new-imagine-lines">Writing lines</Label><Input id="new-imagine-lines" type="number" min={1} max={50} value={lines} onChange={(event) => setLines(Math.max(1, Number(event.target.value) || 1))} /></div>
              <div className="space-y-3"><Label>Background</Label><div className="flex gap-2">{BACKGROUNDS.map((item) => <Button key={item.label} type="button" variant={background === item.src ? "default" : "outline"} size="sm" onClick={() => setBackground(item.src)}>{item.label}</Button>)}</div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Opacity</span><Slider value={[backgroundOpacity]} min={0.2} max={1} step={0.05} onValueChange={([value]) => setBackgroundOpacity(value ?? 1)} /></div></div>
            </div>
            <div className="mt-5 space-y-2"><Label>Writing surface</Label><div className="flex flex-wrap gap-2">{SURFACES.map((surface) => <Button key={surface.id} type="button" variant={surface.id === surfaceId ? "default" : "outline"} size="sm" onClick={() => setSurfaceId(surface.id)}>{surface.label}</Button>)}</div></div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label>Surface finish</Label><div className="grid grid-cols-3 gap-2">{(["clean", "framed", "luminous"] as const).map((item) => <Button key={item} type="button" variant={finish === item ? "default" : "outline"} size="sm" className="capitalize" onClick={() => setFinish(item)}>{item}</Button>)}</div></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label htmlFor="new-imagine-lines-visible">Line numbers</Label><Switch id="new-imagine-lines-visible" checked={lineNumbers} onCheckedChange={setLineNumbers} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="new-imagine-sensor">Writing sensor</Label><Switch id="new-imagine-sensor" checked={sensorVisible} onCheckedChange={setSensorVisible} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="new-imagine-grow">Grow with writing</Label><Switch id="new-imagine-grow" checked={growWithContent} onCheckedChange={setGrowWithContent} /></div>
              </div>
            </div>
            <div className="mt-5 space-y-2"><Label>Writing style</Label><div className="grid max-w-md grid-cols-3 gap-2">{(["flat", "raised", "engraved"] as const).map((item) => <Button key={item} type="button" variant={textTreatment === item ? "default" : "outline"} size="sm" className="capitalize" onClick={() => setTextTreatment(item)}>{item}</Button>)}</div></div>
            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_2fr]">
              <div className="space-y-2"><Label htmlFor="new-imagine-colour">Text colour</Label><input id="new-imagine-colour" type="color" value={textColour} onChange={(event) => setTextColour(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background p-1" /></div>
              <div className="relative min-h-32 overflow-hidden rounded-md border border-border bg-muted" style={{ backgroundImage: `linear-gradient(hsl(var(--background) / ${1 - backgroundOpacity}), hsl(var(--background) / ${1 - backgroundOpacity})), url(${background})`, backgroundSize: "cover", backgroundPosition: "center" }}><div className="absolute inset-x-[8%] top-1/2 -translate-y-1/2 p-4 text-center font-semibold" style={{ color: textColour, background: selectedSurface?.panel.background, border: `2px solid ${finish === "clean" ? "transparent" : selectedSurface?.panel.border}`, borderRadius: selectedSurface?.panel.radius, textShadow: textTreatment === "flat" ? "none" : textTreatment === "engraved" ? `0 1px 0 ${selectedSurface?.inkHighlight}, 0 -1px 1px ${selectedSurface?.inkShadow}` : `0 -1px 0 ${selectedSurface?.inkHighlight}, 0 2px 2px ${selectedSurface?.inkShadow}` }}>x + 7 = 12{sensorVisible ? <span className="sb-sensor ml-1 inline-block h-5 w-0.5 align-middle bg-current" /> : null}</div></div>
            </div>
            <div className="mt-6 flex gap-2"><Button onClick={() => void create()} disabled={busy}>{busy ? "Creating…" : "Create Game"}</Button><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button></div>
          </section>
        ) : null}

        {loading ? <p className="text-sm text-muted-foreground">Opening Game…</p> : role === "student" ? (
          assigned.length ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assigned.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="h-28 bg-muted p-4"><Gamepad2 className="h-8 w-8 text-primary" /></div>
              <div className="p-4"><h2 className="font-semibold">{item.gameName}</h2><p className="mt-1 text-xs text-muted-foreground">{item.topic || "Mathematics"} · Level {item.currentLevel} of {Math.max(1, item.questionCount)}</p><Button className="mt-4 w-full" onClick={() => navigate({ to: "/game/play/$gameId", params: { gameId: item.gameId }, search: { classId: item.classId } as never })}><Play /> {item.status === "in_progress" ? "Continue" : "Play"}</Button></div>
            </article>
          ))}</section> : <p className="text-sm text-muted-foreground">No games have been assigned yet.</p>
        ) : games.length ? (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">My games</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => {
            const surface = SURFACES.find((item) => item.id === game.surfaceId) ?? selectedSurface;
            return <article key={game.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${surface?.texture})` }} />
              <div className="p-4"><div className="flex items-start justify-between gap-2"><h2 className="truncate font-semibold">{game.name}</h2>{game.library ? <span className="shrink-0 rounded-full bg-[#f7f1e6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8d6a43]">Template</span> : null}</div><p className="mt-1 text-xs text-muted-foreground">{[game.topic, game.subtopic].filter(Boolean).join(" · ") || "Mathematics"} · {game.slots.length} lines</p>
                <div className="mt-4 flex flex-wrap gap-2"><Button className="min-h-11 flex-1" size="sm" onClick={() => navigate({ to: "/game/slate/$gameId", params: { gameId: game.id } })}><Pencil /> Edit</Button><Button variant="outline" className="min-h-11" size="sm" onClick={() => navigate({ to: "/game/play/$gameId", params: { gameId: game.id } })}><Play /> Play</Button>{canShare ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-11 w-11" aria-label={`Actions for ${game.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" onSelect={() => void (game.library ? unpublish(game) : publish(game))}>{templateShareAction(game.library === true)}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}<Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Delete ${game.name}`} onClick={async () => { await deleteGame(game.id); setGames(await listGames()); }}><Trash2 /></Button></div>
              </div>
            </article>;
          })}</div></section>
        ) : <p className="text-sm text-muted-foreground">No games yet. Create one to begin.</p>}
      </div>
    </main>
  );
}