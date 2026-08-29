import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  AudioLines,
  FileText,
  Languages,
  Mic,
  Scissors,
  Sparkles,
  Subtitles,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "./SiteNav";
import { listProjects, newProjectId, type ProjectMeta } from "@/lib/editor/storage";
import { VOICE_CATALOG, VOICE_LANGUAGES } from "@/lib/editor/voice-catalog";
import { formatTimecode } from "@/lib/editor/types";

const STEPS = [
  { icon: Scissors, title: "Edit", body: "Cut, trim, split and reorder on a real timeline." },
  { icon: AudioLines, title: "Extract audio", body: "The AI works from audio, never the video." },
  { icon: FileText, title: "Transcribe", body: "Timestamped segments you can edit by hand." },
  { icon: Sparkles, title: "Paraphrase", body: "Tighten the script segment by segment." },
  { icon: Languages, title: "Add a language", body: "Optional versions from the same master." },
  { icon: Mic, title: "Choose a voice", body: "Country, accent, gender and delivery style." },
  { icon: Timer, title: "Synchronise", body: "Every line fits its original timing window." },
  { icon: Subtitles, title: "Subtitles", body: "Styled cues, exportable as .srt or .vtt." },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<ProjectMeta[]>([]);

  useEffect(() => {
    void listProjects().then(setRecent).catch(() => setRecent([]));
  }, []);

  const accents = new Set(VOICE_CATALOG.map((v) => v.accent)).size;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteNav />

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Course production studio
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Transform one video into professional, multilingual course content.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Upload a lesson once, edit it on a real timeline, then produce as many language versions
            as you need — each with its own script, voice, timing and subtitles, all synchronised to
            the same original footage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => void navigate({ to: "/engine", search: { project: newProjectId() } })}
            >
              Create a Video
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/gallery">Open Project</Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            <Stat value={`${VOICE_LANGUAGES.length}+`} label="languages" />
            <Stat value={`${accents}`} label="accents & regional voices" />
            <Stat value="9 stages" label="from raw footage to finished lesson" />
          </div>
        </section>

        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-xl font-semibold">How it works</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One continuous workspace — scroll forward, or go back and change anything at any time.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.title} className="rounded-lg border border-border bg-card p-4">
                  <step.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Recent projects</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything stays in this browser — your original upload is never altered.
              </p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/gallery">View gallery</Link>
            </Button>
          </div>

          {recent.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No projects yet — start with “Create a Video”.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.slice(0, 6).map((meta) => (
                <Link
                  key={meta.key}
                  to="/engine"
                  search={{ project: meta.key }}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/60"
                >
                  <div className="aspect-video bg-secondary">
                    {meta.thumbnail ? (
                      <img
                        src={meta.thumbnail}
                        alt={`${meta.title} thumbnail`}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{meta.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatTimecode(meta.duration, false)} ·{" "}
                      {new Date(meta.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Lesson Studio — one original video, many professional language versions.
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
