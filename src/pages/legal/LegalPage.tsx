import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import SiteFooter from "@/components/common/SiteFooter";
import { BRAND, POLICY_EFFECTIVE_DATE, POLICY_UPDATED_DATE } from "@/lib/legal/seller";

/** One heading + prose block. */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

export const Bullets = ({ items }: { items: string[] }) => (
  <ul className="ml-5 list-disc space-y-1">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

/** Shared shell for the public policy pages, including dates and the footer. */
const LegalPage = ({
  title,
  intro,
  children,
  showDates = true,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  showDates?: boolean;
}) => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.4em] text-primary">{BRAND}</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      {showDates ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Effective date: {POLICY_EFFECTIVE_DATE} · Last updated: {POLICY_UPDATED_DATE}
        </p>
      ) : null}
      {intro ? <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{intro}</div> : null}
      {children}
      <p className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link to="/plans" className="text-primary hover:underline">
          Pricing
        </Link>
        <Link to="/terms" className="text-primary hover:underline">
          Terms
        </Link>
        <Link to="/privacy" className="text-primary hover:underline">
          Privacy
        </Link>
        <Link to="/refund-policy" className="text-primary hover:underline">
          Refunds
        </Link>
        <Link to="/support" className="text-primary hover:underline">
          Support
        </Link>
      </p>
    </div>
    <SiteFooter />
  </main>
);

export default LegalPage;
