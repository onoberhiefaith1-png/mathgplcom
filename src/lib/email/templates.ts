/**
 * The eight platform email templates.
 *
 * Every email MathGPL sends resolves its wording from
 * `public.platform_email_templates`, so the administrator can change subject,
 * body, footer and signature without a code change. This module only describes
 * the templates (labels and the placeholders each one understands) so the
 * dashboard can render editors and previews.
 */

export type TemplateKey =
  | "email_verification"
  | "welcome"
  | "password_reset"
  | "class_invitation"
  | "community_invitation"
  | "assessment_notification"
  | "announcement"
  | "general_notification";

export type TemplateMeta = {
  key: TemplateKey;
  label: string;
  purpose: string;
  placeholders: string[];
};

export const TEMPLATE_META: TemplateMeta[] = [
  {
    key: "email_verification",
    label: "Email Verification",
    purpose: "Sent immediately after registration so the visitor can activate the account.",
    placeholders: ["name", "verification_link", "app_url"],
  },
  {
    key: "welcome",
    label: "Welcome Email",
    purpose: "Sent once the account is activated.",
    placeholders: ["name", "app_url"],
  },
  {
    key: "password_reset",
    label: "Password Reset",
    purpose: "Sent when someone uses Forgot password.",
    placeholders: ["name", "reset_link", "app_url"],
  },
  {
    key: "class_invitation",
    label: "Class Invitation",
    purpose: "Sent when a teacher or school invites someone into a class.",
    placeholders: ["name", "inviter_name", "class_name", "join_link"],
  },
  {
    key: "community_invitation",
    label: "Community Invitation",
    purpose: "Sent when a member invites someone into the MathGPL Community.",
    placeholders: ["name", "inviter_name", "join_link"],
  },
  {
    key: "assessment_notification",
    label: "Assessment Notification",
    purpose: "Sent when a new assessment is published to a class.",
    placeholders: ["name", "assessment_name", "class_name", "open_link"],
  },
  {
    key: "announcement",
    label: "Announcement",
    purpose: "Platform or class announcements.",
    placeholders: ["name", "subject_line", "message"],
  },
  {
    key: "general_notification",
    label: "General Notification",
    purpose: "The catch-all template every future notification can reuse.",
    placeholders: ["name", "subject_line", "message"],
  },
];

export type EmailTemplate = {
  template_key: string;
  display_name: string;
  subject: string;
  body: string;
  footer: string;
  signature: string;
};

export type EmailSender = {
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
};

export type ConnectionState =
  | "connected"
  | "awaiting_dns"
  | "not_connected"
  | "auth_failed"
  | "invalid_credentials"
  | "limit_reached";

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: "Connected",
  awaiting_dns: "Awaiting DNS verification",
  not_connected: "Not connected",
  auth_failed: "Authentication failed",
  invalid_credentials: "Invalid credentials",
  limit_reached: "Daily sending limit reached",
};

/** Fill `{{placeholder}}` slots. Unknown slots are left visible on purpose. */
export function renderTemplate(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : whole,
  );
}

/** Sample values so Preview and Send test email show a realistic message. */
export const PREVIEW_DATA: Record<string, string> = {
  name: "Amara",
  app_url: "https://mathgpl.com",
  verification_link: "https://mathgpl.com/auth/verified?token=sample",
  reset_link: "https://mathgpl.com/auth/reset-password?token=sample",
  join_link: "https://mathgpl.com/join/AB12CD",
  open_link: "https://mathgpl.com/student/classes",
  inviter_name: "Mr Okoro",
  class_name: "Year 9 Mathematics",
  assessment_name: "Quadratic Equations Test",
  subject_line: "A message from MathGPL",
  message: "This is a sample message body.",
};
