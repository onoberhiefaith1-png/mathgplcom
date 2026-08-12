import { Link } from "@/lib/router-compat";
import LegalPage, { Bullets, Section } from "./LegalPage";
import {
  BRAND,
  MERCHANT_OF_RECORD_STATEMENT,
  PADDLE_BUYER_TERMS,
  REFUND_WINDOW_DAYS,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    intro={
      <p>
        These Terms govern your use of {BRAND}. By creating an account, using the platform or purchasing a subscription
        or credits, you agree to them.
      </p>
    }
  >
    <Section title="1. Who you are contracting with">
      <p>
        {BRAND} is the brand and platform operated by {SELLER_LEGAL_NAME}, who is the legal seller of the subscriptions,
        credits and digital educational services offered here. References to “we”, “us” and “our” mean{" "}
        {SELLER_LEGAL_NAME} trading as {BRAND}.
      </p>
    </Section>

    <Section title="2. What MathGPL is">
      <p>
        {BRAND} is an online mathematics education platform providing tools and digital educational resources for
        teachers, students, parents and schools — lesson notes, Smart Board teaching, classes, assignments and
        assessments, adventures, skill building, community assets, academy content and AI-assisted features.
      </p>
    </Section>

    <Section title="3. Account types">
      <p>The platform provides four account types: Teacher, Student, Parent and School.</p>
      <p>
        Different account types and different plans have different features, entitlements and limitations. The features
        available to you are those stated for your account type and the plan you are on. You must provide accurate
        registration information, keep your password confidential and are responsible for activity under your account.
      </p>
    </Section>

    <Section title="4. Plans and subscriptions">
      <p>
        Some plans are free and some are paid. A paid subscription gives you access to the features stated on the
        relevant plan at the time of purchase, for the billing period you paid for. Plan details, prices, billing period
        and included credits are shown on the{" "}
        <Link to="/plans" className="text-primary underline">
          pricing page
        </Link>{" "}
        before you buy.
      </p>
      <p>
        Paid subscriptions renew automatically at the end of each billing period until cancelled. You can cancel at any
        time from your plan page, which stops future renewals. Cancellation does not delete your account: access to paid
        features normally continues to the end of the period you have already paid for, subject to the applicable
        subscription terms and law.
      </p>
    </Section>

    <Section title="5. Credits">
      <p>
        Credits are the platform's internal unit for credit-consuming features such as AI generation, marking and
        certain live or adventure features. Your credit balance and the applicable credit price are displayed before
        purchase and in your account.
      </p>
      <Bullets
        items={[
          "Each plan states the credit allowance included in it.",
          "Credits are deducted as eligible features are used.",
          "Credits may have an expiry period where stated on the relevant plan or credit product — pay-as-you-go credits currently expire one year from purchase.",
          "You should check the applicable plan and credit terms before purchasing.",
        ]}
      />
    </Section>

    <Section title="6. Pay-as-you-go credit purchases">
      <p>
        In addition to a plan, you may buy one-time credit packages. The price of each package is calculated from the
        current credit selling price shown on the pricing page at the time of purchase. Credit packages are a one-time
        purchase and do not renew.
      </p>
    </Section>

    <Section title="7. Pricing changes">
      <p>
        We may update prices, plan contents and credit pricing for future purchases. A customer who has already
        purchased a subscription receives that subscription according to the terms and price applicable to that
        transaction until the subscription expires or renews under its billing terms, unless otherwise required by law.
        New purchases and renewals use the price published at that time, and we will tell you before a change affects a
        renewal.
      </p>
    </Section>

    <Section title="8. Order process and Merchant of Record">
      <p className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-foreground">
        {MERCHANT_OF_RECORD_STATEMENT}
      </p>
      <p>
        Payment, billing, tax, invoicing, cancellation and refund mechanics for orders placed through Paddle are also
        governed by{" "}
        <a className="text-primary underline" href={PADDLE_BUYER_TERMS} target="_blank" rel="noopener noreferrer">
          Paddle's Buyer Terms
        </a>
        . {BRAND} does not process your card details directly and is not the Merchant of Record for those transactions.
      </p>
    </Section>

    <Section title="9. Acceptable use">
      <p>You agree to use {BRAND} for lawful educational purposes only. You must not:</p>
      <Bullets
        items={[
          "Use the platform for any illegal activity.",
          "Commit or attempt fraud, including payment or chargeback fraud.",
          "Abuse, disrupt or overload the platform or its infrastructure.",
          "Access accounts, data or areas of the platform you are not authorised to access.",
          "Attempt to bypass subscription, plan or credit restrictions, metering or paywalls.",
          "Misuse AI features, including generating unlawful, abusive, hateful, sexually explicit or otherwise harmful content, or attempting to circumvent safety limits.",
          "Copy, resell or redistribute paid content or platform assets without permission.",
          "Share account credentials where sharing is not permitted for your account type.",
          "Interfere with platform security, probe it, scrape it or introduce malicious code.",
        ]}
      />
      <p>
        Because children use this platform, content that is abusive, harassing, hateful, sexually explicit or violent is
        strictly prohibited.
      </p>
    </Section>

    <Section title="10. Ownership and intellectual property">
      <p>
        The {BRAND} platform software, branding, original content, engines and platform assets remain the property of{" "}
        {SELLER_LEGAL_NAME} or the relevant rights holder. You receive a limited, non-exclusive, non-transferable right
        to use the platform and any purchased content for its intended educational purpose within your plan.
      </p>
      <p>
        Community assets made available on the platform may be used only in accordance with the permissions {BRAND}{" "}
        provides for them. You may not resell them or present them as your own product.
      </p>
    </Section>

    <Section title="11. Content you create">
      <p>
        You keep ownership of the lesson notes, questions, diagrams, courses and other resources you create. By using
        the platform you grant us the limited licence needed to host, process and display that content in order to
        provide the service — including showing a student's work to the teacher, school or parent responsible for them.
        By publishing a resource publicly, for example through a shared challenge link or the community, you grant us
        permission to host, display and distribute it for that purpose.
      </p>
      <p>
        Student-created work belongs to the student and is visible to the teacher, school or parent connected to that
        account. Do not upload material you do not have the right to share; we will act on credible rights-holder
        complaints, including removing content and suspending repeat infringers.
      </p>
    </Section>

    <Section title="12. AI features and accuracy">
      <p>
        AI-assisted output may contain errors and must be reviewed by a teacher before being relied on for teaching or
        assessment. {BRAND} does not guarantee any particular educational result, grade or learning outcome.
      </p>
    </Section>

    <Section title="13. Service availability">
      <p>
        We work to keep the platform available and performing well, but we do not guarantee uninterrupted or error-free
        operation. Maintenance, updates, third-party outages and events beyond our reasonable control may interrupt the
        service.
      </p>
    </Section>

    <Section title="14. Suspension and termination">
      <p>
        We may suspend or terminate access for material breach of these Terms, non-payment, fraud, security risk, or
        serious or repeated misuse — including misuse of AI features or of another user's account. You may close your
        account at any time. Where suspension or termination is our decision and not caused by your breach, any
        applicable refund is handled under our{" "}
        <Link to="/refund-policy" className="text-primary underline">
          Refund Policy
        </Link>
        .
      </p>
    </Section>

    <Section title="15. Limitation of liability">
      <p>
        To the fullest extent permitted by law, we are not liable for indirect or consequential loss, loss of profits,
        loss of data or loss of goodwill. Our total aggregate liability arising from your use of the platform is limited
        to the amounts you paid to us for the platform in the twelve months before the claim. Nothing in these Terms
        excludes or limits liability that cannot legally be excluded, including liability for fraud, death or personal
        injury caused by negligence, or your statutory consumer rights.
      </p>
    </Section>

    <Section title="16. Independent arrangements between users">
      <p>
        Any tuition fee or payment arranged directly between a teacher, school, parent or student is an independent
        arrangement between those parties. We are not a party to it and do not collect it, except for payments made for{" "}
        {BRAND} subscriptions and credits.
      </p>
    </Section>

    <Section title="17. Complaints and support">
      <p>
        For platform, account or technical matters, contact{" "}
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        or see our{" "}
        <Link to="/support" className="text-primary underline">
          support page
        </Link>
        . For payment, invoice and refund matters, Paddle provides transaction support as Merchant of Record. Change-of-mind
        refund requests for eligible purchases should be made within {REFUND_WINDOW_DAYS} days of the order.
      </p>
    </Section>

    <Section title="18. Governing law">
      <p>
        These Terms are governed by the laws of England and Wales, and the courts of England and Wales have
        jurisdiction, without affecting any mandatory consumer rights available to you locally.
      </p>
    </Section>

    <Section title="19. Related policies">
      <p className="flex flex-wrap gap-4">
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        <Link to="/refund-policy" className="text-primary underline">
          Refund Policy
        </Link>
        <Link to="/plans" className="text-primary underline">
          Pricing
        </Link>
        <Link to="/support" className="text-primary underline">
          Customer Support
        </Link>
      </p>
    </Section>

    <Section title="20. Changes to these Terms">
      <p>
        We may update these Terms as the platform develops. The effective and last-updated dates above show the current
        version, and material changes are communicated to the email address on your account.
      </p>
    </Section>
  </LegalPage>
);

export default Terms;
