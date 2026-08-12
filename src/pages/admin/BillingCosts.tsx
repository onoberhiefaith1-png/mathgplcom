import { Download, FileSpreadsheet } from "lucide-react";

import EmbeddableShell from "@/components/admin/EmbeddableShell";
import { Button } from "@/components/ui/button";

const FILE = "/MathGPL_Master_Cost_and_Expense_Catalogue.xlsx";

const SHEETS = [
  ["Master Cost Catalogue", "79 audited cost rows across every feature area"],
  ["AI Cost Catalogue", "19 AI operations with the model each one actually calls"],
  ["Workspace & Class Costs", "What a workspace, class or copy really creates"],
  ["Storage Costs", "Every feature that leaves bytes behind"],
  ["Live & Infrastructure", "Realtime, sessions, functions, hosting, email"],
  ["Connection & Workspace Map", "All six relationships plus class joins"],
  ["Resource Map", "The meterable resource units in the built system"],
  ["Cost Driver Summary", "What makes the cost increase, in six groups"],
  ["Planned / Future Costs", "Referenced but not implemented today"],
];

const DRIVERS = [
  ["User-based", "Teacher and student seats, parent children, email sends, per-account homepage assets"],
  ["Workspace-based", "Workspaces, classes, per-class lesson-note duplication and check-out copies"],
  ["Usage-based", "Generations, submissions, graded assessments, lines checked, adventures played"],
  ["AI-based", "Text, image and audio provider spend; multi-stage prompting and retries multiply it"],
  ["Storage-based", "Video backgrounds, generated media, student work, board state, backups"],
  ["Infrastructure-based", "Realtime and presence, live sessions, server invocations, database, CDN, email"],
];

export default function BillingCosts({ embedded }: { embedded?: boolean } = {}) {
  return (
    <EmbeddableShell embedded={embedded} title="Billing & Costs" subtitle="Cost audit of the platform as built — the foundation for subscription design">
      <div className="space-y-6">
        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-6 w-6 text-dash-accent" />
              <div>
                <h2 className="text-lg font-semibold text-dash-surface">MathGPL Master Cost &amp; Expense Catalogue</h2>
                <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">
                  Nine sheets auditing every resource, operation and relationship that can create a cost. Where the real
                  provider price is unknown, the cell reads “Provider cost required” rather than a guess. No plan or
                  pricing decisions are contained in it.
                </p>
              </div>
            </div>
            <Button asChild size="lg">
              <a href={FILE} download>
                <Download className="mr-2 h-4 w-4" /> Download .xlsx
              </a>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHEETS.map(([name, desc]) => (
            <div key={name} className="rounded-xl border border-dash-surface/12 bg-dash-surface/5 p-4">
              <p className="text-sm font-semibold text-dash-surface">{name}</p>
              <p className="mt-1 text-xs leading-relaxed text-dash-surface/65">{desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent">What makes cost increase</h2>
          <ul className="mt-4 space-y-3">
            {DRIVERS.map(([group, detail]) => (
              <li key={group} className="flex flex-col gap-1 border-b border-dash-surface/10 pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4">
                <span className="w-48 shrink-0 text-sm font-semibold text-dash-surface">{group}</span>
                <span className="text-sm text-dash-surface/70">{detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </EmbeddableShell>
  );
}
