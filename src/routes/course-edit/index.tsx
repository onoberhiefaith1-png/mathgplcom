import { createFileRoute } from "@tanstack/react-router";
import { WelcomePage } from "@/components/courseedit/CourseEditWelcome";

export const Route = createFileRoute("/course-edit/")({
  head: () => ({
    meta: [
      { title: "Course Edit — One Video, Many Language Versions | MathGPL" },
      {
        name: "description",
        content:
          "Turn one lesson video into professional, multilingual course content: edit, transcribe, paraphrase, translate, voice, synchronise and subtitle in one workspace.",
      },
      { property: "og:title", content: "Course Edit — One Video, Many Language Versions | MathGPL" },
      {
        property: "og:description",
        content:
          "Upload once, then produce as many language versions of your lesson as you need — all from the same untouched original video.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});
