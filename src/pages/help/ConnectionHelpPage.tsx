import { Link } from "@tanstack/react-router";

/** Public explainer for "This connection is not private" warnings caused by network filters. */
const ConnectionHelpPage = () => {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">
        “This connection is not private” on MathGPL
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        If your phone or laptop shows a warning saying the connection is not private, or that the
        site may be impersonating mathgpl.com, MathGPL itself is almost certainly fine. The warning
        is coming from the network you are on.
      </p>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-medium text-foreground">Why it happens</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Many schools, offices and family-filter apps inspect every secure page you open. To do
          that, the filter opens the page on your behalf and then re-signs it with its own security
          certificate. Your browser notices the page was not signed by MathGPL and warns you. A
          browser suggestion that mentions a “web filter violation” is a strong sign this is what
          is happening.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-medium text-foreground">Confirm it in 30 seconds</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Turn Wi-Fi off so your phone uses mobile data.</li>
          <li>
            Open <span className="font-medium text-foreground">https://mathgpl.com</span> again.
          </li>
          <li>
            If it loads normally, the warning was caused by the Wi-Fi network’s filter, not by
            MathGPL.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          You can also check{" "}
          <Link to="/status" className="font-medium text-primary underline">
            the live status page
          </Link>{" "}
          to see whether MathGPL services are running.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-medium text-foreground">What to ask your IT team</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send them this line — it is all they need:
        </p>
        <blockquote className="mt-3 rounded-lg bg-muted p-4 text-sm text-foreground">
          Please allow <span className="font-medium">mathgpl.com</span> and{" "}
          <span className="font-medium">*.mathgpl.com</span> through the web filter, and exclude the
          domain from HTTPS/SSL inspection. It is a classroom mathematics teaching site.
        </blockquote>
        <p className="mt-3 text-sm text-muted-foreground">
          If a new device is showing the warning on a network where MathGPL normally works, check
          that the device’s date and time are correct — a wrong clock produces the same message.
        </p>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        MathGPL is served over HTTPS with a certificate that renews automatically. We can never see
        or change the certificate a local filter substitutes on your network.
      </p>
    </main>
  );
};

export default ConnectionHelpPage;
