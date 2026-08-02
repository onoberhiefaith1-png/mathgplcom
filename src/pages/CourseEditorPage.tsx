import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Eye, Image as ImageIcon, Layers, Loader2, Settings as SettingsIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BackgroundEditor from "@/components/coursebuilder/BackgroundEditor";
import SectionsEditor from "@/components/coursebuilder/SectionsEditor";
import SettingsPanel from "@/components/coursebuilder/SettingsPanel";
import StudentView from "@/components/coursebuilder/StudentView";
import {
  addBlock,
  addSection,
  deleteBlock,
  deleteSection,
  loadCourseTree,
  moveBlock,
  updateBlockConfig,
  updateCourse,
  updateSection,
} from "@/lib/courses/api";
import { uploadCourseMedia } from "@/lib/courses/media";
import type { BlockKind, Course, CourseTree } from "@/lib/courses/types";

type Tab = "background" | "sections" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: "background", label: "Background", icon: ImageIcon },
  { id: "sections", label: "Sections", icon: Layers },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

/** Split-screen Course Editor: authoring on the left, the live Student View
 *  on the right. Every change saves itself. */
const CourseEditorPage = () => {
  const params = useParams() as { courseId?: string };
  const courseId = params.courseId ?? "";
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [tab, setTab] = useState<Tab>("background");
  const [mobilePreview, setMobilePreview] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("view") === "student") setMobilePreview(true);
  }, []);

  useEffect(() => {
    if (!courseId) return;
    void loadCourseTree(courseId)
      .then(setTree)
      .catch((e: unknown) =>
        toast({ title: "Could not open course", description: String((e as Error)?.message ?? e), variant: "destructive" }),
      );
  }, [courseId]);

  /** Debounced persistence keyed by field group, so typing stays smooth. */
  const queueSave = useCallback((key: string, run: () => Promise<void>) => {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      void run().catch((e: unknown) =>
        toast({ title: "Save failed", description: String((e as Error)?.message ?? e), variant: "destructive" }),
      );
    }, 500);
  }, []);

  const patchCourse = useCallback(
    (patch: Partial<Course>) => {
      setTree((prev) => (prev ? { ...prev, course: { ...prev.course, ...patch } } : prev));
      queueSave("course", () => updateCourse(courseId, patch));
    },
    [courseId, queueSave],
  );

  const handlers = useMemo(
    () => ({
      onAddSection: async () => {
        if (!tree) return;
        const section = await addSection(courseId, tree.sections.length);
        setTree((prev) => (prev ? { ...prev, sections: [...prev.sections, section] } : prev));
      },
      onRenameSection: (id: string, title: string) => {
        setTree((prev) =>
          prev ? { ...prev, sections: prev.sections.map((s) => (s.id === id ? { ...s, title } : s)) } : prev,
        );
        queueSave(`section:${id}`, () => updateSection(id, { title }));
      },
      onDeleteSection: async (id: string) => {
        if (!window.confirm("Delete this section and everything inside it?")) return;
        await deleteSection(id);
        setTree((prev) =>
          prev
            ? {
                ...prev,
                sections: prev.sections.filter((s) => s.id !== id),
                blocks: prev.blocks.filter((b) => b.section_id !== id),
              }
            : prev,
        );
      },
      onDuplicateSection: async (id: string) => {
        if (!tree) return;
        const source = tree.sections.find((s) => s.id === id);
        if (!source) return;
        const copy = await addSection(courseId, tree.sections.length);
        await updateSection(copy.id, { title: `${source.title} (copy)` });
        const newBlocks = [];
        for (const b of tree.blocks.filter((x) => x.section_id === id)) {
          const nb = await addBlock(copy.id, b.kind, b.position);
          await updateBlockConfig(nb.id, b.config);
          newBlocks.push({ ...nb, config: b.config });
        }
        setTree((prev) =>
          prev
            ? {
                ...prev,
                sections: [...prev.sections, { ...copy, title: `${source.title} (copy)` }],
                blocks: [...prev.blocks, ...newBlocks],
              }
            : prev,
        );
      },
      onAddBlock: async (sectionId: string, kind: BlockKind) => {
        if (!tree) return;
        const position = tree.blocks.filter((b) => b.section_id === sectionId).length;
        const block = await addBlock(sectionId, kind, position);
        setTree((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
      },
      onPatchBlock: (id: string, patch: Record<string, unknown>) => {
        const file = patch["__uploadVideo"] as File | undefined;
        const rest = { ...patch };
        delete rest["__uploadVideo"];

        setTree((prev) =>
          prev
            ? {
                ...prev,
                blocks: prev.blocks.map((b) => (b.id === id ? { ...b, config: { ...b.config, ...rest } } : b)),
              }
            : prev,
        );

        const current = tree?.blocks.find((b) => b.id === id);
        const nextConfig = { ...(current?.config ?? {}), ...rest };
        queueSave(`block:${id}`, () => updateBlockConfig(id, nextConfig));

        if (file) {
          void (async () => {
            try {
              const path = await uploadCourseMedia(courseId, file);
              const withUpload = { ...nextConfig, source: "upload" as const, storagePath: path, url: "" };
              setTree((prev) =>
                prev
                  ? { ...prev, blocks: prev.blocks.map((b) => (b.id === id ? { ...b, config: withUpload } : b)) }
                  : prev,
              );
              await updateBlockConfig(id, withUpload);
              toast({ title: "Video uploaded" });
            } catch (e: unknown) {
              toast({ title: "Upload failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
            }
          })();
        }
      },
      onMoveBlock: async (id: string, dir: -1 | 1) => {
        if (!tree) return;
        const block = tree.blocks.find((b) => b.id === id);
        if (!block) return;
        const siblings = tree.blocks
          .filter((b) => b.section_id === block.section_id)
          .sort((a, b) => a.position - b.position);
        const idx = siblings.findIndex((b) => b.id === id);
        const swap = siblings[idx + dir];
        if (!swap) return;
        setTree((prev) =>
          prev
            ? {
                ...prev,
                blocks: prev.blocks.map((b) =>
                  b.id === block.id
                    ? { ...b, position: swap.position }
                    : b.id === swap.id
                      ? { ...b, position: block.position }
                      : b,
                ),
              }
            : prev,
        );
        await moveBlock(block.id, swap.position);
        await moveBlock(swap.id, block.position);
      },
      onDeleteBlock: async (id: string) => {
        await deleteBlock(id);
        setTree((prev) => (prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== id) } : prev));
      },
    }),
    [courseId, queueSave, tree],
  );

  if (!tree) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening course…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-5">
        <Link
          to="/course-builder"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Skill Builder
        </Link>
        <h1 className="truncate text-base font-semibold text-white">{tree.course.title || "Untitled course"}</h1>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-200">
          {tree.course.status === "published" ? "Published" : "Draft"}
        </span>
        <button
          type="button"
          onClick={() => setMobilePreview((v) => !v)}
          className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm text-slate-100 transition hover:bg-white/20 lg:hidden"
        >
          <Eye className="h-4 w-4" /> {mobilePreview ? "Edit" : "Student View"}
        </button>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-6 pb-16 lg:grid-cols-2">
        <section className={`${mobilePreview ? "hidden lg:block" : ""}`}>
          <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm transition ${
                  tab === t.id ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:text-white"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {tab === "background" && <BackgroundEditor course={tree.course} onPatch={patchCourse} />}
          {tab === "sections" && (
            <SectionsEditor
              sections={tree.sections}
              blocks={tree.blocks}
              questions={tree.questions}
              onAddSection={() => void handlers.onAddSection()}
              onRenameSection={handlers.onRenameSection}
              onDeleteSection={(id) => void handlers.onDeleteSection(id)}
              onDuplicateSection={(id) => void handlers.onDuplicateSection(id)}
              onAddBlock={(sectionId, kind) => void handlers.onAddBlock(sectionId, kind)}
              onPatchBlock={handlers.onPatchBlock}
              onMoveBlock={(id, dir) => void handlers.onMoveBlock(id, dir)}
              onDeleteBlock={(id) => void handlers.onDeleteBlock(id)}
            />
          )}
          {tab === "settings" && <SettingsPanel course={tree.course} onPatch={patchCourse} />}
        </section>

        <section className={`${mobilePreview ? "" : "hidden lg:block"}`}>
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <Eye className="h-3.5 w-3.5" /> Student View
          </div>
          <StudentView tree={tree} />
        </section>
      </main>
    </div>
  );
};

export default CourseEditorPage;
