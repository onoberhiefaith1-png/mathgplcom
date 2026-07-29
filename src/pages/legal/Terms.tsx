import { Link } from "@/lib/router-compat";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Terms = () => (
  <main className="min-h-screen bg-background px-6 py-14 text-foreground">
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
      <h1 className="mt-2 text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        By creating an account you agree to the terms below.
      </p>

      <Section title="1. An educational platform">
        <p>
          MathGPL is a mathematics teaching and learning platform. Accounts are provided so schools,
          teachers, parents and students can create lessons, run classes and follow progress. You agree
          to use the platform for lawful educational purposes only.
        </p>
      </Section>

      <Section title="2. Prohibited content and conduct">
        <p>
          You may not upload, publish or share content that is unlawful, abusive, harassing, hateful,
          sexually explicit, violent, or otherwise harmful — particularly given that children use this
          platform. You may not attempt to disrupt the service, access other accounts, or misuse the
          AI features to generate prohibited content. Accounts that breach this may be suspended.
        </p>
      </Section>

      <Section title="3. Resource sharing">
        <p>
          You keep ownership of the lesson notes, questions, diagrams and other resources you create.
          By sharing a resource publicly (for example through a Smart Card challenge link) you grant
          MathGPL permission to host, display and distribute it for that purpose. Do not upload
          material you do not have the right to share.
        </p>
      </Section>

      <Section title="4. Independent financial relationships">
        <p>
          Any tuition, fees or payment arranged between a teacher, a school, a parent or a student is
          an independent arrangement between those parties. MathGPL is not a party to it, does not
          collect it on their behalf, and is not responsible for its outcome unless the payment is
          made directly to MathGPL for platform subscriptions.
        </p>
      </Section>

      <Section title="5. Privacy">
        <p>
          We collect only the information needed to run the platform. Student dates of birth are used
          internally to recommend age-appropriate content and are never displayed publicly. Full
          details are in our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section title="6. Email communications">
        <p>
          We always send account and security messages such as verification, password resets and
          important service notices. Product updates and newsletters are optional and are sent only if
          you opt in; you can unsubscribe from those at any time.
        </p>
      </Section>

      <Section title="7. Accounts and termination">
        <p>
          You are responsible for keeping your password secure and for activity under your account.
          You may close your account at any time. We may suspend or close accounts that breach these
          terms.
        </p>
      </Section>

      <Section title="8. Changes">
        <p>
          We may update these terms as the platform develops. Material changes will be communicated to
          the email on your account.
        </p>
      </Section>

      <Link to="/" className="mt-10 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Back to the academy
      </Link>
    </div>
  </main>
);

export default Terms;
