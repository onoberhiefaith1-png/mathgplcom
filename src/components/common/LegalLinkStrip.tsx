import { Link } from "@/lib/router-compat";

const items = [
  { to: "/plans", label: "Pricing" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/refund-policy", label: "Refunds" },
  { to: "/support", label: "Support" },
];

/**
 * Discreet policy links for full-screen scenes that cannot carry a full footer.
 * Buyers must always be one click from the terms, privacy and refund pages.
 */
const LegalLinkStrip = () => (
  <nav className="pointer-events-auto fixed bottom-1 left-1/2 z-40 flex -translate-x-1/2 flex-wrap justify-center gap-3 rounded-full bg-background/50 px-4 py-1 text-[10px] text-muted-foreground backdrop-blur">
    {items.map((i) => (
      <Link key={i.to} to={i.to} className="hover:text-foreground hover:underline">
        {i.label}
      </Link>
    ))}
  </nav>
);

export default LegalLinkStrip;
