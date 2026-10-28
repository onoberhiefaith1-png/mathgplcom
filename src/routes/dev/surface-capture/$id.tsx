import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const SurfaceCapture = lazy(() => import("@/components/dev/SurfaceCapture"));

export const Route = createFileRoute("/dev/surface-capture/$id")({
  head: () => ({ meta: [{ title: "Surface capture" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <SurfaceCapture id={id} />
      </Suspense>
    </ClientOnly>
  );
}
