import { Link } from "@/lib/router-compat";
import LegalPage, { Bullets, Section } from "./LegalPage";
import {
  BRAND,
  MERCHANT_OF_RECORD_STATEMENT,
  PADDLE_BUYER_SUPPORT,
  SELLER_LEGAL_NAME,
  SUPPORT_EMAIL,
} from "@/lib/legal/seller";

const Support = () => (
  <LegalPage
    title="Customer Support"
    showDates={false}
    intro={
      <p>
        {BRAND} is operated by {SELLER_LEGAL_NAME}. We aim to answer every message within two working days.
      </p>
    }
  >
    <Section title="Contact us">
      <p>
        Email{" "}
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>{" "}
        from the address on your account and include your MathGPL ID where possible.
      </p>
      <p>Contact us about:</p>
      <Bullets
        items={[
          "Account access, sign-in and MathGPL ID questions.",
          "Classes, students, schools, parents and connections.",
          "Lesson notes, Smart Board, assignments, adventures and skills.",
          "Plans, credit balances and how credits are used.",
          "Technical problems or bugs.",
          "Privacy requests and data deletion.",
        ]}
      />
    </Section>

    <Section title="Payments, invoices and refunds">
      <p className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-foreground">
        {MERCHANT_OF_RECORD_STATEMENT}
      </p>
      <p>
        For payment transaction support — receipts and invoices, updating a payment method, cancelling a subscription, or
        requesting a refund — you can contact Paddle directly at{" "}
        <a className="text-primary underline" href={PADDLE_BUYER_SUPPORT} target="_blank" rel="noopener noreferrer">
          paddle.net
        </a>{" "}
        using the email address you paid with, or use the link on your transaction receipt.
      </p>
      <p>
        You can also write to us and we will review the request and work with Paddle on the applicable refund process.
        Approved refunds are always processed through Paddle. Our refund rules are set out in the{" "}
        <Link to="/refund-policy" className="text-primary underline">
          Refund Policy
        </Link>
        .
      </p>
    </Section>

    <Section title="Before you buy">
      <p className="flex flex-wrap gap-4">
        <Link to="/plans" className="text-primary underline">
          Pricing and plans
        </Link>
        <Link to="/terms" className="text-primary underline">
          Terms of Service
        </Link>
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        <Link to="/refund-policy" className="text-primary underline">
          Refund Policy
        </Link>
      </p>
    </Section>
  </LegalPage>
);

export default Support;
