import { Link } from "@/lib/router-compat";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Privacy = () => (
  <main className="min-h-screen bg-background px-6 py-14 text-foreground">
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is maintained by MathGPL to explain what we collect and why.
      </p>

      <Section title="What we collect">
        <p>
          Account details you give us at registration: first and last name, email address, country and
          time zone, plus the extra fields for your account type (school name and type, display name,
          subjects taught, number of children, or a student's date of birth). We also store the lesson
          notes, classes, assignments and results you create while using the platform.
        </p>
      </Section>

      <Section title="Student date of birth">
        <p>
          A student's date of birth is used internally only, to recommend age-appropriate content and
          adapt the learning experience. It is never shown on a public profile, a leaderboard or a
          shared challenge page.
        </p>
      </Section>

      <Section title="How we use your information">
        <p>
          To provide the service, authenticate you, keep your work associated with your account, show
          teachers and parents the progress of the students they are responsible for, and send account
          and security emails. Product updates and newsletters are sent only if you opt in.
        </p>
      </Section>

      <Section title="Who can see your data">
        <p>
          Access follows the ownership model of the platform: a school can see the teachers and
          students it owns, a teacher can see the students in their own classes, and a parent can see
          their own children. Accounts belonging to different owners are kept separate. Publicly shared
          challenge pages show only the information needed for that challenge, such as a display name
          and score.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          We keep your data while your account is active. You may request deletion of your account and
          associated personal data by contacting us from the email address on your account.
        </p>
      </Section>

      <Section title="Cookies and session storage">
        <p>
          We use browser storage to keep you signed in and to remember the page you were heading to
          before signing in. We do not use it for advertising.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions or requests, contact us using the address on your account emails.
        </p>
      </Section>

      <Link to="/" className="mt-10 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Back to the academy
      </Link>
    </div>
  </main>
);

export default Privacy;
