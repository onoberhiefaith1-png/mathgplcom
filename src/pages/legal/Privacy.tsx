import LegalPage, { Bullets, Section } from "./LegalPage";
import { BRAND, SELLER_LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/legal/seller";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    intro={
      <p>
        This Privacy Policy explains what personal information {BRAND} collects, why it is collected, who it is shared
        with, and the rights you have over it.
      </p>
    }
  >
    <Section title="1. Who we are">
      <p>
        {BRAND} is an online mathematics education platform operated by {SELLER_LEGAL_NAME}, the legal seller of the
        subscriptions and credit-based digital services offered on this website. {SELLER_LEGAL_NAME} is the data
        controller for the personal information described in this policy.
      </p>
      <p>
        For any privacy question or request, contact{" "}
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </Section>

    <Section title="2. What the platform provides">
      <p>
        {BRAND} provides mathematics teaching and learning tools: lesson notes, Smart Board teaching, classes,
        assignments and assessments, adventures, skill building, community assets, academy content, AI-assisted
        generation and marking, subscriptions and credit-based features.
      </p>
    </Section>

    <Section title="3. Personal information we collect">
      <p>Depending on your account type and how you use the platform, we may collect:</p>
      <Bullets
        items={[
          "Name and, for students, a date of birth used only to recommend age-appropriate content.",
          "Email address and account login information, including a hashed password and your MathGPL ID.",
          "Your role on the platform: Teacher, Student, Parent or School.",
          "School, organisation and class information, including class membership and join codes.",
          "Learning and progress information: attempts, lines of working, scores and completion data.",
          "Assignment and assessment information created by you or set for you.",
          "Platform usage information, including the features you use and credit-consuming activity.",
          "Subscription and payment records: plan, price paid, billing period, transaction references and credit balances.",
          "Support and contact information you send us, including the content of your messages.",
          "Technical and device information needed to operate and secure the service, such as IP address, browser type, device identifiers and security logs.",
        ]}
      />
      <p>
        We do not store complete payment card details. Card data is entered on the payment provider's checkout and is
        handled by that provider, not by {BRAND}.
      </p>
    </Section>

    <Section title="4. How we use personal information">
      <Bullets
        items={[
          "Creating, authenticating and managing accounts.",
          "Providing the platform's teaching, learning and Smart Board features.",
          "Managing classes, students, schools, parents and their connections.",
          "Recording and reporting assignments, assessments and progress to the teacher, school or parent responsible for a student.",
          "Providing AI-assisted features where available.",
          "Managing subscriptions, plans, credit allowances and credit balances.",
          "Processing payments, renewals and refunds through our payment provider.",
          "Preventing fraud, abuse and misuse of credits or AI features.",
          "Maintaining the security and integrity of the platform.",
          "Providing customer support and responding to your requests.",
          "Improving and developing the platform, including diagnosing faults.",
          "Complying with legal, accounting and tax obligations.",
        ]}
      />
    </Section>

    <Section title="5. Legal bases for processing">
      <Bullets
        items={[
          "Performance of a contract: providing the accounts, subscriptions, credits and features you sign up for.",
          "Legitimate interests: securing the platform, preventing fraud and abuse, and improving the service.",
          "Consent: optional communications such as product updates and newsletters, which you can withdraw at any time.",
          "Legal obligation: keeping transaction, tax and accounting records and responding to lawful requests.",
        ]}
      />
    </Section>

    <Section title="6. Payments and Paddle">
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all
        our orders and acts as the seller of record for the transaction. When you make a purchase, the information
        necessary to complete that transaction — such as your name, email address, billing country and address details,
        the items purchased and the transaction amount — is processed by Paddle for payment processing, subscription
        management, refunds, invoicing, tax compliance and fraud prevention.
      </p>
      <p>
        Paddle processes that information as an independent controller for those purposes and under its own privacy
        notice. We receive from Paddle the transaction records needed to activate your subscription or credits, support
        you and keep our accounts.
      </p>
    </Section>

    <Section title="7. Service providers and processors">
      <p>We share personal information only with providers that help us run the platform, including:</p>
      <Bullets
        items={[
          "Paddle, as Merchant of Record and payment provider.",
          "Cloud hosting, database, storage and authentication infrastructure providers.",
          "AI model providers used to generate or check mathematical content, which receive the content of the request needed to produce the result.",
          "Email delivery providers used for account, security and support messages.",
          "Professional advisers such as accountants, where necessary.",
          "Authorities or regulators where we are legally required to disclose information.",
        ]}
      />
      <p>We do not sell personal information and we do not use it for third-party advertising.</p>
    </Section>

    <Section title="8. Who can see your data inside the platform">
      <p>
        Access follows the platform's ownership model. A school can see the teachers and students it owns; a teacher can
        see the students in the classes they teach; a parent can see the children connected to their account. Accounts
        belonging to different organisations are kept separate, and a student's date of birth is never displayed
        publicly, on a leaderboard or on a shared challenge page.
      </p>
    </Section>

    <Section title="9. Retention and deletion">
      <p>
        We keep personal information only as long as reasonably necessary for the purposes described above, or as
        required by law. Account and learning data is retained while your account is active. You may request deletion of
        your account and associated personal data by contacting us from the email address on your account.
      </p>
      <p>
        Some information must be retained after deletion for legal, security, fraud-prevention, accounting or
        transaction-record purposes — for example invoices and transaction records required by tax law.
      </p>
    </Section>

    <Section title="10. Security">
      <p>
        We use reasonable technical and organisational measures to protect personal information against unauthorised
        access, loss, misuse, alteration or disclosure. These include encrypted connections, hashed credentials,
        row-level access rules in the database, restricted administrative access and security logging. No online service
        can be guaranteed to be completely secure, so we cannot promise absolute security.
      </p>
    </Section>

    <Section title="11. International transfers">
      <p>
        Our providers may process information outside your country, including outside the UK and EEA. Where that
        happens, we rely on appropriate safeguards such as adequacy decisions or standard contractual clauses.
      </p>
    </Section>

    <Section title="12. Your rights">
      <p>Subject to applicable law, you have the right to:</p>
      <Bullets
        items={[
          "Access the personal information we hold about you.",
          "Have inaccurate information corrected.",
          "Request deletion of your information.",
          "Request restriction of processing.",
          "Object to processing based on legitimate interests.",
          "Receive a portable copy of information you provided to us.",
          "Withdraw consent where processing is based on consent.",
        ]}
      />
      <p>
        To exercise any of these rights, email{" "}
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        from the address on your account. We aim to respond within one month. If you are in the UK or EEA you may also
        complain to your local data protection authority.
      </p>
    </Section>

    <Section title="13. Cookies and browser storage">
      <p>
        We use cookies and browser storage that are necessary to run the platform: keeping you signed in, remembering
        the page you were heading to before signing in, and holding session and security information. We do not use
        cookies for advertising or cross-site tracking. You can clear this storage in your browser, though signing in
        will then be required again.
      </p>
    </Section>

    <Section title="14. Children">
      <p>
        Student accounts are created and supervised by a school, teacher or parent. A student's date of birth is used
        internally only, to adapt content to their age. Where consent is required for a child, it is obtained through
        the school or parent responsible for that account.
      </p>
    </Section>

    <Section title="15. Changes to this policy">
      <p>
        We may update this policy as the platform develops. The effective and last-updated dates above always show the
        current version, and material changes are communicated to the email address on your account.
      </p>
    </Section>
  </LegalPage>
);

export default Privacy;
