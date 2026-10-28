import { Link } from "@/lib/router-compat";
import LegalPage, { Bullets, Section } from "./LegalPage";
import {
  BRAND,
  MERCHANT_OF_RECORD_STATEMENT,
  PADDLE_BUYER_SUPPORT,
  PADDLE_BUYER_TERMS,
  REFUND_WINDOW_DAYS,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    intro={
      <>
        <p>
          These terms are an agreement between you and {SELLER_LEGAL_NAME}, a sole proprietor trading as {BRAND} ("we",
          "us"). {SELLER_LEGAL_NAME} is the seller and supplier of the {BRAND} service. By creating an account or
          continuing to use {BRAND} you agree to these terms.
        </p>
        <p>
          If you are registering on behalf of a school or organisation, you confirm you have authority to accept these
          terms for it. If you are an individual, you confirm you are of legal age to enter into this agreement, or that
          a parent, guardian or school is doing so for you.
        </p>
      </>
    }
  >
    <Section title="1. The service">
      <p>
        {BRAND} is a mathematics teaching and learning platform. Accounts let schools, teachers, parents and students
        create lesson notes, run classes and live sessions, use the Smartboard and adventures, set assignments and follow
        progress. Some features consume credits, which are included with paid plans or bought separately.
      </p>
      <p>
        We grant you a limited, non-exclusive, non-transferable right to use the service within the plan you have
        selected, for lawful educational purposes.
      </p>
    </Section>

    <Section title="2. Your account">
      <p>
        You must give accurate registration information and keep it up to date. You are responsible for keeping your
        credentials confidential and for activity carried out under your account. Tell us at {SUPPORT_EMAIL} if you
        believe your account has been used without your permission.
      </p>
    </Section>

    <Section title="3. Prohibited content and conduct">
      <p>You may not:</p>
      <Bullets
        items={[
          "Use the service unlawfully, or for fraud, spam or misrepresentation.",
          "Upload, publish or share content that is abusive, harassing, hateful, sexually explicit, violent or otherwise harmful — particularly given that children use this platform.",
          "Infringe anyone else's intellectual property or upload material you have no right to share.",
          "Interfere with the security or integrity of the service: no malware, probing, scanning, scraping, or attempts to access other accounts or workspaces.",
          "Reverse engineer the service, resell or redistribute it, or circumvent technical or plan limits, including credit limits.",
          "Misuse the AI features to generate prohibited content, or present AI output as verified professional advice.",
        ]}
      />
      <p>
        You are responsible for the prompts you submit, for having the rights to any content you input, and for checking
        AI-generated output before using it with students.
      </p>
    </Section>

    <Section title="4. Intellectual property and your content">
      <p>
        We retain ownership of the {BRAND} service and all intellectual property in it, including its software,
        documentation, design and branding. You keep ownership of the lesson notes, questions, diagrams and other
        resources you create. By sharing a resource publicly — for example through a Smart Card challenge link or the
        community area — you grant us permission to host, display and distribute it for that purpose. You grant us a
        limited licence to host and process your content solely to provide the service to you.
      </p>
      <p>
        If you believe content on {BRAND} infringes your rights, contact {SUPPORT_EMAIL}. We will review and may remove
        the content, and we may suspend accounts that infringe repeatedly.
      </p>
    </Section>

    <Section title="5. Plans, credits and billing">
      <Bullets
        items={[
          "Prices for plans and credit packages are published on the pricing page and are shown to you before you confirm a purchase, including any applicable tax calculated at checkout.",
          "Paid plans are subscriptions. Unless stated otherwise on the pricing page they are billed monthly in advance and renew automatically for further periods until cancelled.",
          "Each paid plan includes a monthly credit allowance. Credits are consumed as you use metered features, and credit packages you buy separately are valid for one year from the date of purchase.",
          "Credits have no cash value, are not transferable between accounts, and are not redeemable for money outside the refund rules.",
          "You may cancel at any time to stop future renewals. Access continues until the end of the period you have already paid for, unless the account is terminated for breach.",
          "If a renewal payment fails, we may pause metered features until payment succeeds. Paddle may retry the payment before the subscription is cancelled.",
          "We may change prices or plan contents for future billing periods. Changes do not alter the price locked in for a period you have already paid for, and we will tell you before a change takes effect.",
        ]}
      />
      <p>
        Payment, billing, tax, invoicing and cancellation mechanics for orders placed through checkout are also governed
        by{" "}
        <a href={PADDLE_BUYER_TERMS} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Paddle's Buyer Terms
        </a>
        .
      </p>
    </Section>

    <Section title="6. Reseller and Merchant of Record">
      <p>{MERCHANT_OF_RECORD_STATEMENT}</p>
      <p>
        This means your order is placed with Paddle.com, your invoice and receipt come from Paddle, and Paddle handles
        payment support and processes any refund that is due. We do not collect or store your card details and we do not
        pay refunds to you directly. You can manage payments, invoices and refund requests at{" "}
        <a href={PADDLE_BUYER_SUPPORT} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          paddle.net
        </a>
        .
      </p>
    </Section>

    <Section title="7. Refunds">
      <p>
        We offer a {REFUND_WINDOW_DAYS}-day window for change-of-mind requests on eligible purchases. Full details, the
        conditions that apply and how to request a refund are set out in our{" "}
        <Link to="/refund-policy" className="text-primary underline">
          Refund Policy
        </Link>
        . Refunds are processed by Paddle as Merchant of Record.
      </p>
    </Section>

    <Section title="8. Service level, availability and warranties">
      <p>
        We aim to keep {BRAND} available and working well, and to give reasonable notice of planned maintenance. However
        the service is provided "as is" and "as available". We do not warrant that it will be uninterrupted, error-free,
        free of defects, or that AI-generated content will always be accurate or suitable for a particular class or
        curriculum. You are responsible for reviewing AI output before teaching with it.
      </p>
      <p>
        To the fullest extent permitted by law we exclude all implied warranties and conditions, including implied
        warranties of merchantability, satisfactory quality and fitness for a particular purpose. Nothing in these terms
        excludes rights you have under consumer law that cannot lawfully be excluded.
      </p>
    </Section>

    <Section title="9. Limitation of liability">
      <p>
        To the fullest extent permitted by law, we are not liable for indirect, consequential or special loss, including
        loss of profits, loss of data, loss of goodwill or loss of anticipated savings. Our total aggregate liability
        arising out of or in connection with these terms is limited to the fees you paid us for the service in the twelve
        months before the event giving rise to the claim.
      </p>
      <p>
        We do not exclude or limit liability for fraud or fraudulent misrepresentation, for death or personal injury
        caused by negligence, or for anything else that cannot lawfully be limited.
      </p>
    </Section>

    <Section title="10. Your indemnity">
      <p>
        You agree to indemnify us against claims, losses and reasonable costs arising from content you upload or share,
        from your unlawful use of the service, or from your breach of these terms.
      </p>
    </Section>

    <Section title="11. Suspension and termination">
      <p>We may suspend or terminate access to an account, in whole or in part, where:</p>
      <Bullets
        items={[
          "there is a material breach of these terms;",
          "a payment due for the account has not been made;",
          "there is a security, fraud or safeguarding risk to the platform or its users; or",
          "the account repeatedly or seriously breaches the prohibited conduct rules above.",
        ]}
      />
      <p>
        Where practical and appropriate we will warn you first and give you a chance to put things right. You may close
        your account at any time. When access ends you may request an export of your content for 30 days, after which it
        may be deleted in line with our{" "}
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        .
      </p>
    </Section>

    <Section title="12. Independent financial arrangements">
      <p>
        Any tuition, fees or payment arranged between a teacher, school, parent or student is an independent arrangement
        between those parties. We are not a party to it, do not collect it on their behalf, and are not responsible for
        its outcome. The only payments made to us are for {BRAND} plans and credits, placed through Paddle.
      </p>
    </Section>

    <Section title="13. Privacy and email">
      <p>
        We collect only the information needed to run the platform, as described in our{" "}
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        . We always send account and security messages such as verification, password resets and important service
        notices. Product updates and newsletters are optional and sent only if you opt in; you can unsubscribe from those
        at any time.
      </p>
    </Section>

    <Section title="14. Changes, assignment and force majeure">
      <p>
        We may update these terms as the platform develops; material changes will be communicated to the email address on
        your account and the effective date above will be updated. You may not assign your rights under these terms
        without our consent; we may assign ours as part of a merger, acquisition or reorganisation. Neither party is
        liable for failure to perform caused by events beyond its reasonable control.
      </p>
    </Section>

    <Section title="15. Governing law and disputes">
      <p>
        These terms are governed by the laws of England and Wales, and the courts of England and Wales have
        non-exclusive jurisdiction. This does not remove any right you have to bring proceedings in your country of
        residence where consumer law allows it.
      </p>
    </Section>

    <Section title="16. Contact">
      <p>
        {SELLER_LEGAL_NAME}, trading as {BRAND} — support and legal notices:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>
        . For payment, invoice or refund queries, contact Paddle at{" "}
        <a href={PADDLE_BUYER_SUPPORT} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          paddle.net
        </a>
        .
      </p>
    </Section>
  </LegalPage>
);

export default Terms;
