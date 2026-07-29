import { Link } from "@/lib/router-compat";
import { ACCOUNT_MENU, AUTH_ROLES } from "@/lib/accounts/authForms";

/** The single front door: pick an account type, then sign in or register. */
const AccountChooser = () => (
  <main className="cinematic-sky flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-foreground">
    <div className="w-full max-w-lg rounded-2xl border border-amber-200/15 bg-card/60 p-6 shadow-2xl backdrop-blur">
      <p className="text-center text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
      <h1 className="mt-2 text-center text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Choose the account you are signing in to, or create a new one.
      </p>
      <div className="mt-6 grid gap-2">
        {ACCOUNT_MENU.map((item) => (
          <Link
            key={item.key}
            to={`/auth/${item.key}`}
            className="rounded-xl border border-border bg-background/40 p-3 text-left transition hover:border-primary/60 hover:bg-primary/10"
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{AUTH_ROLES[item.key].blurb}</div>
          </Link>
        ))}
      </div>
    </div>
    <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to the academy</Link>
  </main>
);

export default AccountChooser;
