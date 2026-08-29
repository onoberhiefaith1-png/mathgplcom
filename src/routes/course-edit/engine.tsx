import { createFileRoute } from "@tanstack/react-router";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";

interface EngineSearch {
  project?: string;
}

export const Route = createFileRoute("/course-edit/engine")({
  validateSearch: (search: Record<string, unknown>): EngineSearch => ({
    ...(typeof search["project"] === "string" ? { project: search["project"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Video Engine — Produce a Lesson | MathGPL Course Edit" },
      {
        name: "description",
        content:
          "One scrolling workspace: edit the timeline, extract audio, transcribe, paraphrase, voice, synchronise, subtitle and publish your lesson video.",
      },
      { property: "og:title", content: "Video Engine — Produce a Lesson | MathGPL Course Edit" },
      {
        property: "og:description",
        content:
          "Edit, transcribe, paraphrase, voice, time and subtitle a lesson video in a single professional workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnginePage,
});

function EnginePage() {
  const { project } = Route.useSearch();
  return <EditorWorkspace projectId={project} />;
}
