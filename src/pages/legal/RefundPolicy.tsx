import { Link } from "@/lib/router-compat";
import LegalPage, { Bullets, Section } from "./LegalPage";
import {
  BRAND,
  PADDLE_BUYER_SUPPORT,
  REFUND_WINDOW_DAYS,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const RefundPolicy = () => (
  <LegalPage
    title="Refund Policy"
    intro={
      <>
        <p>
          {BRAND}, operated by {SELLER_LEGAL_NAME}, provides digital educational services, subscriptions and
          credit-based digital features.
        </p>
        <p>
          Because digital products and services may be made available immediately after purchase, refund eligibility
          depends on the type of purchase, whether the service or content has been used, applicable law, and Paddle's
          applicable refund rules. For eligible purchases we consider change-of-mind requests made within{" "}
          {REFUND_WINDOW_DAYS} days of the order date.
        </p>
      </>
    }
  >
    <Section title="Subscriptions">
      <p>
        You may cancel a subscription at any time to prevent future renewal. Cancellation does not automatically mean
        that the current paid period is refunded. Access normally continues until the end of the applicable paid period
        unless otherwise required by law or the subscription is otherwise terminated.
      </p>
      <p>
        Where a subscription has been purchased and substantially unused within the {REFUND_WINDOW_DAYS}-day window, a
        full or partial refund may be available in line with the rules below.
      </p>
    </Section>

    <Section title="Credits">
      <p>
        For credit purchases, the amount of credit actually used is taken into account when determining any refund. If
        you have unused credits remaining, you may request a refund for the eligible unused portion, subject to:
      </p>
      <Bullets
        items={[
          "the applicable Paddle refund rules;",
          "applicable consumer protection law;",
          "the transaction type;",
          "whether the credits have been used;",
          "whether the credits have expired; and",
          "any applicable refund restrictions.",
        ]}
      />
      <p>
        Used credits are not refundable merely because you no longer wish to use them. Where appropriate, a partial
        refund may be calculated based on the unused eligible credit balance.
      </p>
    </Section>

    <Section title="Technical problems">
      <p>
        If you experience a material technical problem that prevents access to a purchased product or service, please
        contact {BRAND} support first so the issue can be investigated and resolved where possible. If the issue cannot
        reasonably be resolved, you may be eligible for a refund in accordance with applicable law and Paddle's refund
        procedures.
      </p>
    </Section>

    <Section title="Statutory rights">
      <p>
        Nothing in this Refund Policy removes or limits any statutory consumer rights that cannot legally be excluded.
        For customers in the UK, EU/EEA or other jurisdictions with mandatory withdrawal or refund rights, those rights
        apply where applicable.
      </p>
    </Section>

    <Section title="How refunds are processed (Paddle)">
      <p>
        Payments processed through Paddle are transactions for which Paddle acts as Merchant of Record. Where a refund is
        approved, the refund is processed through Paddle — {BRAND} does not pay refunds directly to customers or transfer
        money to your card or bank account itself.
      </p>
      <p>
        You can use the refund and support route provided by Paddle at{" "}
        <a className="text-primary underline" href={PADDLE_BUYER_SUPPORT} target="_blank" rel="noopener noreferrer">
          paddle.net
        </a>
        , the link on your transaction receipt, or your account billing interface.
      </p>
    </Section>

    <Section title="Making a refund request">
      <p>A refund request should include:</p>
      <Bullets
        items={[
          "the email address on your account;",
          "transaction or order details;",
          "the reason for the request; and",
          "the relevant subscription or credit purchase.",
        ]}
      />
      <p>
        Send requests to{" "}
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        . We review requests where appropriate and work with Paddle according to the applicable refund process. See also
        our{" "}
        <Link to="/terms" className="text-primary underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/support" className="text-primary underline">
          support page
        </Link>
        .
      </p>
    </Section>
  </LegalPage>
);

export default RefundPolicy;
