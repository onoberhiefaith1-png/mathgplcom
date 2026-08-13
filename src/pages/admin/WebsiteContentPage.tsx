import { useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import GameAssetPickerDialog from "@/components/gamebuilder/GameAssetPickerDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import WelcomePage from "@/pages/WelcomePage";
import { uploadGameAsset, renderPathOf } from "@/lib/games/assets";
import {
  mergeDraft,
  resolveSiteContentForPreview,
  useSiteAdmin,
  type SectionPatch,
} from "@/lib/site/useSiteAdmin";
import {
  SECTION_TITLES,
  type SiteContent,
  type SiteItem,
  type SiteMediaRef,
  type SiteSection,
} from "@/lib/site/types";

const ITEM_KINDS = new Set(["panels", "showcase", "audience", "compare"]);

/** Upload / clear one media reference. */
const MediaField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: SiteMediaRef | null;
  onChange: (next: SiteMediaRef | null) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const asset = await uploadGameAsset(file, "background", file.name);
      onChange({
        path: renderPathOf(asset),
        source: "storage",
        mediaType: asset.media_type === "video" ? "video" : "image",
      });
      toast.success("Media uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black/40">
        {value?.path ? (
          <SignedMedia
            path={value.path}
            source={value.source}
            mediaType={value.mediaType}
            fit="cover"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> No media yet
            </span>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {value?.path ? "Replace" : "Upload"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <UploadCloud className="mr-2 h-4 w-4" /> File
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPicking(true)}>
              <ImageIcon className="mr-2 h-4 w-4" /> GPL Assets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {value?.path && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      <GameAssetPickerDialog
        open={picking}
        onOpenChange={setPicking}
        onPick={(pick) => {
          onChange({ path: pick.path, source: "storage", mediaType: pick.mediaType });
          toast.success("Asset selected");
        }}
      />

    </div>
  );
};

const SectionCard = ({
  row,
  onSave,
  onPublish,
  onMove,
  onVisible,
}: {
  row: SiteSection;
  onSave: (patch: SectionPatch) => Promise<void>;
  onPublish: () => Promise<void>;
  onMove: (direction: -1 | 1) => void;
  onVisible: (visible: boolean) => void;
}) => {
  const merged = mergeDraft(row);
  const [patch, setPatch] = useState<SectionPatch>({});
  const [busy, setBusy] = useState(false);
  const value = { ...merged, ...patch } as SiteSection;
  const dirty = Object.keys(patch).length > 0;
  const hasDraft = Boolean(row.draft && Object.keys(row.draft).length > 0);

  const set = (key: keyof SectionPatch, next: unknown) =>
    setPatch((prev) => ({ ...prev, [key]: next }));

  const items: SiteItem[] = (value.items ?? []) as SiteItem[];
  const setItems = (next: SiteItem[]) => set("items", next);

  const run = async (fn: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {SECTION_TITLES[row.key] ?? row.key}
          </h2>
          <p className="text-xs text-muted-foreground">
            {row.kind}
            {hasDraft ? " · unpublished draft" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            {row.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <Switch checked={row.visible} onCheckedChange={onVisible} aria-label="Section visible" />
          </span>
        </div>
      </header>

      {row.kind !== "footer" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-3">
            {row.kind === "hero" && (
              <Input
                placeholder="Eyebrow (small line above the headline)"
                value={value.eyebrow ?? ""}
                onChange={(e) => set("eyebrow", e.target.value)}
              />
            )}
            <Textarea
              placeholder="Headline — short and powerful"
              value={value.headline ?? ""}
              onChange={(e) => set("headline", e.target.value)}
              rows={2}
            />
            <Textarea
              placeholder="Short supporting line (optional)"
              value={value.subline ?? ""}
              onChange={(e) => set("subline", e.target.value)}
              rows={2}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Button label"
                value={value.cta_label ?? ""}
                onChange={(e) => set("cta_label", e.target.value)}
              />
              <Input
                placeholder="Button link, e.g. /signup"
                value={value.cta_href ?? ""}
                onChange={(e) => set("cta_href", e.target.value)}
              />
            </div>

            {ITEM_KINDS.has(row.kind) && (
              <div className="space-y-3 rounded-xl border border-border/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Panels
                </p>
                {items.map((item, index) => (
                  <div key={item.id} className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                    <Input
                      placeholder="Label"
                      value={item.label ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, label: e.target.value };
                        setItems(next);
                      }}
                    />
                    <Input
                      placeholder="Short line"
                      value={item.headline ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, headline: e.target.value };
                        setItems(next);
                      }}
                    />
                    <div className="sm:col-span-2">
                      <MediaField
                        label="Panel media"
                        value={item.media ?? null}
                        onChange={(media) => {
                          const next = [...items];
                          next[index] = { ...item, media };
                          setItems(next);
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="sm:col-span-2 justify-self-start"
                      onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove panel
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setItems([...items, { id: `item-${Date.now()}`, label: "", headline: "" }])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add panel
                </Button>
              </div>
            )}
          </div>

          <MediaField
            label="Section media (image or video)"
            value={(value.media ?? null) as SiteMediaRef | null}
            onChange={(media) => set("media", media)}
          />
        </div>
      )}

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || !dirty}
          onClick={() =>
            run(async () => {
              await onSave(patch);
              setPatch({});
            }, "Draft saved")
          }
        >
          <Save className="mr-2 h-4 w-4" /> Save draft
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (dirty) await onSave(patch);
              await onPublish();
              setPatch({});
            }, "Section published")
          }
        >
          <UploadCloud className="mr-2 h-4 w-4" /> Publish
        </Button>
        {dirty && <span className="text-xs text-primary">Unsaved changes</span>}
      </footer>
    </section>
  );
};

/** Website content management for the public homepage. */
const WebsiteContentPage = () => {
  const admin = useSiteAdmin();
  const [preview, setPreview] = useState<SiteContent | null>(null);
  const [newQuote, setNewQuote] = useState({ author_name: "", author_role: "", organisation: "", quote: "" });

  const ordered = useMemo(
    () => [...admin.rows].sort((a, b) => a.position - b.position),
    [admin.rows],
  );

  const openPreview = async () => {
    const content = await resolveSiteContentForPreview(
      admin.rows,
      admin.testimonials,
      admin.stats,
      admin.statsSettings,
    );
    setPreview(content);
  };

  if (preview) {
    return (
      <div className="relative">
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2">
          <Button size="sm" onClick={() => setPreview(null)}>
            Close preview
          </Button>
        </div>
        <WelcomePage content={preview} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-5">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Platform Console
        </Link>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => void openPreview()}>
            Preview
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void admin
                .publishAll(admin.rows)
                .then(() => toast.success("Homepage published"))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Publish failed"))
            }
          >
            <UploadCloud className="mr-2 h-4 w-4" /> Publish all
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-24">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every section of the public homepage. Upload images and video, keep the words short, hide
            what isn't ready, then publish.
          </p>
        </div>

        {admin.loading && (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sections…
          </p>
        )}

        {ordered.map((row) => (
          <SectionCard
            key={row.id}
            row={row}
            onSave={(patch) => admin.saveDraft(row, patch)}
            onPublish={() => admin.publish(row)}
            onMove={(direction) => void admin.move(row, direction)}
            onVisible={(visible) => void admin.setVisible(row, visible)}
          />
        ))}

        {/* By the numbers — real counts only, each one opt-in. */}
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="text-base font-semibold">By the numbers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are live platform counts. Switch on only the ones worth showing — the section hides
            itself when everything is off.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["show_learners", "Learners", admin.stats?.learners],
                ["show_teachers", "Teachers", admin.stats?.teachers],
                ["show_schools", "Schools", admin.stats?.schools],
                ["show_questions", "Questions solved", admin.stats?.questions],
                ["show_adventures", "Adventures completed", admin.stats?.adventures],
              ] as const
            ).map(([key, label, count]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  {label} <span className="text-muted-foreground">· {count ?? 0}</span>
                </span>
                <Switch
                  checked={admin.statsSettings?.[key] ?? false}
                  onCheckedChange={(checked) => void admin.updateStatsSettings({ [key]: checked })}
                />
              </label>
            ))}
          </div>
        </section>

        {/* Social proof — real testimonials only. */}
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="text-base font-semibold">Testimonials</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The homepage section stays hidden until at least one testimonial is approved.
          </p>

          <div className="mt-4 space-y-3">
            {admin.testimonials.map((t) => (
              <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.author_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.quote}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">Approved</span>
                  <Switch
                    checked={t.approved}
                    onCheckedChange={(checked) =>
                      void admin.saveTestimonial({ id: t.id, approved: checked })
                    }
                  />
                  <Button size="icon" variant="ghost" onClick={() => void admin.deleteTestimonial(t.id)} aria-label="Delete testimonial">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-2">
            <Input
              placeholder="Name"
              value={newQuote.author_name}
              onChange={(e) => setNewQuote({ ...newQuote, author_name: e.target.value })}
            />
            <Input
              placeholder="Role, e.g. Mathematics teacher"
              value={newQuote.author_role}
              onChange={(e) => setNewQuote({ ...newQuote, author_role: e.target.value })}
            />
            <Input
              placeholder="School or organisation"
              value={newQuote.organisation}
              onChange={(e) => setNewQuote({ ...newQuote, organisation: e.target.value })}
            />
            <Textarea
              className="sm:col-span-2"
              placeholder="What they said"
              rows={2}
              value={newQuote.quote}
              onChange={(e) => setNewQuote({ ...newQuote, quote: e.target.value })}
            />
            <Button
              size="sm"
              className="justify-self-start"
              disabled={!newQuote.author_name.trim() || !newQuote.quote.trim()}
              onClick={() =>
                void admin
                  .saveTestimonial({ ...newQuote, approved: false })
                  .then(() => {
                    setNewQuote({ author_name: "", author_role: "", organisation: "", quote: "" });
                    toast.success("Testimonial added — approve it to show it");
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not add"))
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add testimonial
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WebsiteContentPage;
