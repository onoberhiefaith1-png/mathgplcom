import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Gamepad2, Search, Settings as SettingsIcon, MoreVertical, Users, Clock, User as UserIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createGame, deleteGame, listGames, sceneCount, updateGame } from "@/lib/adventure/api";
import { CARD_FRAMES, pickFrame } from "@/lib/adventure/cardFrames";
import type { AdventureGame } from "@/lib/adventure/types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Row extends AdventureGame { scenes?: number }

type Filter = "all" | "recent" | "mine" | "shared";

export default function AdventureGamesDashboard() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState({ name: "", topic: "", subtopic: "", description: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
    });
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listGames();
      const withCounts: Row[] = await Promise.all(
        list.map(async (g) => ({ ...g, scenes: await sceneCount(g.id).catch(() => 0) })),
      );
      setGames(withCounts);
    } catch (e: unknown) {
      toast({ title: "Could not load games", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim()) return;
    try {
      const g = await createGame({
        name: form.name.trim(),
        topic: form.topic.trim() || undefined,
        subtopic: form.subtopic.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setOpen(false);
      setForm({ name: "", topic: "", subtopic: "", description: "" });
      navigate(`/adventure/games/${g.id}`);
    } catch (e: unknown) {
      toast({ title: "Could not create game", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this game? This removes all its scenes and questions.")) return;
    try { await deleteGame(id); setGames((arr) => arr.filter((g) => g.id !== id)); }
    catch (e: unknown) { toast({ title: "Delete failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };

  const setFrame = async (id: string, frame_index: number | null) => {
    try {
      await updateGame(id, { frame_index });
      setGames((arr) => arr.map((g) => (g.id === id ? { ...g, frame_index } : g)));
    } catch (e: unknown) {
      toast({ title: "Could not update frame", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const filtered = games.filter((g) => {
    if (search && !`${g.name} ${g.topic ?? ""} ${g.subtopic ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "recent") {
      const week = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - new Date(g.updated_at).getTime() < week;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[hsl(232_45%_8%)] text-foreground">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-4 border-b border-white/5 px-6 py-4">
        <Link to="/adventure" className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/30 to-purple-500/30">
            <Gamepad2 className="h-6 w-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide">GAME MODE</h1>
            <p className="text-xs text-muted-foreground">Create and manage your adventure games</p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            className="h-10 rounded-full border-white/10 bg-white/5 pl-9"
          />
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="h-10 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 px-5 font-semibold hover:from-indigo-400 hover:to-purple-500"
        >
          <Plus className="mr-1 h-4 w-4" /> CREATE GAME
        </Button>
      </header>

      <div className="flex">
        {/* Left rail */}
        <aside className="hidden w-44 shrink-0 flex-col gap-2 border-r border-white/5 p-3 lg:flex">
          <RailButton active={filter === "all"} onClick={() => setFilter("all")} icon={<Gamepad2 className="h-5 w-5" />} label="All Games" />
          <RailButton active={filter === "recent"} onClick={() => setFilter("recent")} icon={<Clock className="h-5 w-5" />} label="Recent" />
          <RailButton active={filter === "mine"} onClick={() => setFilter("mine")} icon={<UserIcon className="h-5 w-5" />} label="My Games" />
          <RailButton active={filter === "shared"} onClick={() => setFilter("shared")} icon={<Users className="h-5 w-5" />} label="Shared" />
          <div className="mt-6 rounded-lg border border-white/5 bg-white/5 p-3 text-center">
            <Star className="mx-auto mb-1 h-5 w-5 text-amber-400" />
            <div className="text-xs text-muted-foreground">Total Games</div>
            <div className="text-2xl font-bold text-amber-400">{games.length}</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-12 text-center text-muted-foreground">
              No adventure games yet. Click <strong className="text-foreground">Create Game</strong> to start.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((g, i) => (
                <GameCard
                  key={g.id}
                  game={g}
                  position={i}
                  onOpen={() => navigate(`/adventure/games/${g.id}`)}
                  onDelete={() => remove(g.id)}
                  onPickFrame={(idx) => setFrame(g.id, idx)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Adventure Game</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Game Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Factorisation Adventure" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Algebra" /></div>
              <div><Label>Subtopic</Label><Input value={form.subtopic} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} placeholder="Factorisation" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Students unlock the castle by solving challenges." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RailButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs font-medium transition ${
        active ? "border-indigo-400/50 bg-gradient-to-br from-indigo-600/30 to-purple-600/30 text-white" : "border-white/5 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function GameCard({ game, position, onOpen, onDelete, onPickFrame }: {
  game: Row; position: number; onOpen: () => void; onDelete: () => void; onPickFrame: (idx: number | null) => void;
}) {
  const frame = pickFrame(position, game.frame_index);
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer transition-transform hover:-translate-y-1"
      style={{ aspectRatio: "362 / 543" }}
    >
      <img src={frame.url} alt="" className="pointer-events-none absolute inset-0 h-full w-full select-none" draggable={false} />

      {/* Menu */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="absolute right-[10%] top-[8%] z-10 rounded-full bg-black/60 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <SettingsIcon className="h-3 w-3" /> Frame Style
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => onPickFrame(null)}
              className={`col-span-4 rounded border px-2 py-1 text-xs ${game.frame_index == null ? "border-primary bg-primary/10" : "border-white/10"}`}
            >Auto (cycle)</button>
            {CARD_FRAMES.map((f) => (
              <button
                key={f.index}
                onClick={() => onPickFrame(f.index)}
                className={`aspect-[2/3] overflow-hidden rounded border ${game.frame_index === f.index ? "border-primary ring-2 ring-primary" : "border-white/10"}`}
              >
                <img src={f.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            ><Trash2 className="h-3 w-3" /> Delete game</button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Text overlay (lower label area of the frame) */}
      <div className="absolute inset-x-[10%] bottom-[6%] top-[58%] flex flex-col justify-center px-2 text-center">
        <div className="line-clamp-1 text-base font-extrabold tracking-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          {game.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[10px]">
          {game.topic && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white"
              style={{ backgroundColor: frame.accent }}
            >
              <span className="opacity-70">Topic:</span> {game.topic}
            </span>
          )}
          {game.subtopic && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white/90 ring-1 ring-white/30"
              style={{ backgroundColor: `${frame.accent.replace(")", " / 0.4)").replace("hsl(", "hsla(")}` }}
            >
              <span className="opacity-70">Sub:</span> {game.subtopic}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px] text-white/80 drop-shadow">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {game.scenes ?? 0} Scenes</span>
          <span>{new Date(game.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
