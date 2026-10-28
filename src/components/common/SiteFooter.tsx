import { Link } from "@/lib/router-compat";
import {
  BRAND,
  MERCHANT_OF_RECORD_STATEMENT,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const links = [
  { to: "/plans", label: "Pricing" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/support", label: "Support" },
];

/**
 * Public footer. It names the legal seller, discloses the Merchant of Record
 * and links every policy a buyer must be able to read before purchasing.
 */
const SiteFooter = () => (
  <footer className="mt-16 border-t border-border/60 bg-background/70 px-6 py-10 text-sm backdrop-blur">
    <div className="mx-auto max-w-5xl space-y-4">
      <nav className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-muted-foreground hover:text-foreground">
            {l.label}
          </Link>
        ))}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted-foreground hover:text-foreground">
          {SUPPORT_EMAIL}
        </a>
      </nav>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {BRAND} is operated by {SELLER_LEGAL_NAME}. {MERCHANT_OF_RECORD_STATEMENT}
      </p>
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SELLER_LEGAL_NAME}. All rights reserved.
      </p>
    </div>
  </footer>
);

export default SiteFooter;
