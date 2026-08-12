import LegalPage, { Bullets, Section } from "./LegalPage";
import {
  BRAND,
  PADDLE_BUYER_SUPPORT,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    intro={
      <>
        <p>
          {BRAND} is operated by {SELLER_LEGAL_NAME} ("we", "us"), a sole proprietor trading as {BRAND}.{" "}
          {SELLER_LEGAL_NAME} is the data controller for the personal data described in this notice and decides how and
          why it is processed.
        </p>
        <p>
          This notice explains what we collect, why we collect it, the legal basis we rely on, who we share it with, how
          long we keep it, how we protect it, and the rights you have. Questions or requests can be sent to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </>
    }
  >
    <Section title="Who we are">
      <Bullets
        items={[
          `Data controller: ${SELLER_LEGAL_NAME}, trading as ${BRAND}`,
          `Contact for privacy requests: ${SUPPORT_EMAIL}`,
          "Payment processing and order handling: Paddle.com Market Limited, our reseller and Merchant of Record",
        ]}
      />
    </Section>

    <Section title="Personal data we collect">
      <p>Account and identity data you give us when you register or are registered by a school, teacher or parent:</p>
      <Bullets
        items={[
          "First and last name, and the display name you choose",
          "Email address and account credentials (passwords are stored only as a secure hash)",
          "Country and time zone",
          "Account-type details: school name and type, subjects taught, number of children, or a student's date of birth",
        ]}
      />
      <p>Data created while you use the platform:</p>
      <Bullets
        items={[
          "Lesson notes, questions, diagrams, classes, courses, assignments, attempts and results",
          "Live session and class membership records, and the connections between schools, teachers, parents and students",
          "Usage and metering records: which features were used, when, the volume of AI generation, and the credits consumed",
          "Support messages you send us",
          "Technical data needed to run and secure the service: IP address, device and browser information, and error logs",
        ]}
      />
      <p>
        We do not collect or store your card number, card expiry date or security code. Payment details are collected and
        processed by Paddle.
      </p>
    </Section>

    <Section title="Why we use it, and our legal basis">
      <Bullets
        items={[
          "To create and administer your account and provide the platform you asked for — legal basis: performance of a contract with you.",
          "To process orders, subscriptions, credit purchases, invoices and tax — legal basis: performance of a contract, and compliance with legal obligations. Order handling is carried out by Paddle as Merchant of Record.",
          "To show schools, teachers and parents the progress of the students they are responsible for — legal basis: performance of a contract with the account that holds that responsibility, and our legitimate interest in providing a teaching platform that works as expected.",
          "To meter usage, allocate credits and prevent abuse of paid AI features — legal basis: performance of a contract and our legitimate interests.",
          "To keep the service secure, investigate incidents and prevent fraud — legal basis: our legitimate interests and legal obligations.",
          "To send account, security and transactional emails such as verification and password resets — legal basis: performance of a contract.",
          "To send optional product updates or newsletters — legal basis: your consent, which you can withdraw at any time.",
        ]}
      />
    </Section>

    <Section title="A student's date of birth">
      <p>
        A student's date of birth is used internally only, to recommend age-appropriate content and adapt the learning
        experience. It is never shown on a public profile, a leaderboard or a shared challenge page.
      </p>
    </Section>

    <Section title="Who we share data with">
      <p>We do not sell personal data. We share it only with the following categories of recipient:</p>
      <Bullets
        items={[
          "Merchant of Record and payment processor: Paddle.com Market Limited, which handles checkout, payment processing, subscription billing, invoicing, sales-tax compliance, payment support and refunds for our orders. Paddle receives the order and billing information needed for those purposes.",
          "Service providers and subprocessors that host and operate the platform: cloud hosting, database and storage providers, email delivery, and the AI model providers that generate lesson content when you request it.",
          "Schools, teachers and parents you are connected to, limited to the students and classes within their own workspace.",
          "Professional advisers such as legal and accounting advisers, where necessary.",
          "Public authorities, where we are required to disclose information by law.",
        ]}
      />
      <p>
        Because Paddle is the Merchant of Record for our orders, Paddle is an independent controller of the payment data
        it collects and applies its own privacy notice to it. Payment and billing queries can be raised with Paddle at{" "}
        <a href={PADDLE_BUYER_SUPPORT} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          paddle.net
        </a>
        .
      </p>
    </Section>

    <Section title="Who can see your work inside the platform">
      <p>
        Access follows the ownership model of the platform: a school can see the teachers and students in its own
        workspace, a teacher can see the students in their own classes, and a parent can see their own children.
        Workspaces belonging to different owners are kept separate. Publicly shared challenge pages show only what that
        challenge needs, such as a display name and a score.
      </p>
    </Section>

    <Section title="International transfers">
      <p>
        Our hosting, payment and AI providers may process data outside your country. Where personal data is transferred
        out of the UK or the EEA, we rely on an adequacy decision or on Standard Contractual Clauses with the recipient,
        together with the technical measures described below.
      </p>
    </Section>

    <Section title="How we protect your data">
      <Bullets
        items={[
          "Data is encrypted in transit using HTTPS/TLS and encrypted at rest by our hosting and database providers.",
          "Passwords are never stored in readable form; they are stored as salted hashes.",
          "Access to data is enforced per row in the database, so an account can only reach the records its role and workspace allow.",
          "Administrative access is limited to the accounts that need it, and privileged operations run only on the server.",
          "We keep audit and error logs to detect and investigate unusual activity.",
        ]}
      />
      <p>
        No system can be guaranteed to be completely secure, but we apply appropriate technical and organisational
        measures and review them as the platform develops.
      </p>
    </Section>

    <Section title="How long we keep it">
      <Bullets
        items={[
          "Account and platform content: while your account is active, and for a short period afterwards to allow recovery of an account closed in error.",
          "Order, billing and tax records: for as long as tax and accounting law requires, typically six years.",
          "Usage and metering records: retained to support billing and credit history, then aggregated or deleted.",
          "Support messages: retained while needed to resolve your request and for a reasonable period afterwards.",
        ]}
      />
      <p>When data is no longer needed for these purposes it is deleted or irreversibly anonymised.</p>
    </Section>

    <Section title="Your rights">
      <p>
        Subject to the law that applies to you, you can ask us to give you a copy of your data, correct it, delete it,
        restrict or object to how we use it, or provide it in a portable format. Where we rely on consent you can
        withdraw it at any time. You can also complain to your data protection supervisory authority.
      </p>
      <p>
        Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        from the address on your account and we will respond within one month. Where a student's account is administered
        by a school or parent, we may need to route the request through that account holder.
      </p>
    </Section>

    <Section title="Cookies and browser storage">
      <p>
        We use essential cookies and browser storage to keep you signed in, hold your session, and remember the page you
        were heading to before signing in. We do not use advertising cookies and we do not track you across other
        websites. Paddle may set cookies necessary to operate its checkout. You can clear this storage in your browser at
        any time, though doing so will sign you out.
      </p>
    </Section>

    <Section title="Changes to this notice">
      <p>
        We may update this notice as the platform develops. The effective date above always reflects the current
        version, and material changes will be communicated to the email address on your account.
      </p>
    </Section>
  </LegalPage>
);

export default Privacy;
