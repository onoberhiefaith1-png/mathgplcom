import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/course-builder", label: "Courses" },
  { to: "/course-edit", label: "Studio" },
  { to: "/course-edit/engine", label: "Video Engine" },
  { to: "/course-edit/gallery", label: "Gallery" },
] as const;

export function SiteNav() {

  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
            else void router.navigate({ to: "/course-edit" });
          }}
        >
          <ArrowLeft className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Link to="/course-edit" className="flex items-center gap-2 font-semibold tracking-tight">
          <Clapperboard className="size-5 text-primary" />
          Lesson Studio
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 bg-secondary text-foreground" }}
              activeOptions={{ exact: link.to === "/" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
