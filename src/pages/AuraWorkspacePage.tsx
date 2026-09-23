// The front door: a teacher arrives, says what they want, and watches it happen.
//
// Everything here is the conversation that already runs in Aura's side panel,
// given the whole screen. Each thing she does shows as a step the teacher can
// walk into, so the work is always checkable in the real pages.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2 } from "lucide-react";

import AuraCockpit from "@/components/agent/AuraCockpit";
import { useAuraMaybe } from "@/lib/agent/AuraProvider";
import { Button } from "@/components/ui/button";

const OPENERS = [
  "Create a lesson note on quadratic equations with two worked questions",
  "Set up a new class and add my students",
  "Make a game from the question I wrote yesterday",
  "Show me what I have in my workspace",
];

export default function AuraWorkspacePage() {
  const aura = useAuraMaybe();
  const [showCost, setShowCost] = useState(false);

  // Before anyone signs in there is no assistant to talk to yet.
  if (!aura) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold">Sign in to talk to Aura</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once you are signed in you can simply tell her what you want — a lesson note, a class, a
          game — and she builds it while you watch.
        </p>
        <Button asChild>
          <Link to="/auth" search={{ next: "/aura" } as never}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  const { send, status, messages, spendNote } = aura;
  const started = messages.length > 0;
  const busy = status === "submitted";

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">Aura</h1>
          <p className="truncate text-xs text-muted-foreground">
            Tell her what you want. She does it, and shows you where.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setShowCost((on) => !on)}
          >
            {showCost ? "Hide cost" : "Cost today"}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
            <Link to="/">
              <Building2 className="size-3.5" />
              My building
            </Link>
          </Button>
        </div>
      </header>

      {showCost ? (
        <p className="border-b border-border bg-muted/40 px-4 py-2 text-center text-[11px] text-muted-foreground">
          {spendNote} Figures are measured from each reply and converted at an approximate rate.
        </p>
      ) : null}

      {!started && !busy ? (
        <div className="border-b border-border px-4 py-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {OPENERS.map((text) => (
              <Button
                key={text}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto max-w-full whitespace-normal py-2 text-left text-xs"
                onClick={() => send(text)}
              >
                {text}
                <ArrowRight className="ml-1.5 size-3 shrink-0" />
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <AuraCockpit variant="page" />
      </div>
    </div>
  );
}
