import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import JoinClassPanel from "@/components/class/JoinClassPanel";

/**
 * Standalone Join route — kept for invite links (/join and /join/:code).
 * The in-app Join Class surface now lives inside the Classes page.
 */
const JoinClassPage = () => {
  const { code } = useParams<{ code?: string }>();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/teaching-hub/classes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Classes
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Join a Class</h1>
        <div className="w-16" />
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <JoinClassPanel initialCode={code} />
      </main>
    </div>
  );
};

export default JoinClassPage;
