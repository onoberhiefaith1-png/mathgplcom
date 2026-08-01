-- Platform email configuration (owner-only)
CREATE TABLE IF NOT EXISTS public.platform_email_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  sender_name text NOT NULL DEFAULT 'MathGPL',
  sender_email text NOT NULL DEFAULT '',
  reply_to_email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_email_settings TO authenticated;
GRANT ALL ON public.platform_email_settings TO service_role;
ALTER TABLE public.platform_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read email settings" ON public.platform_email_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE POLICY "Owners insert email settings" ON public.platform_email_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));
CREATE POLICY "Owners update email settings" ON public.platform_email_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

INSERT INTO public.platform_email_settings (id, sender_name, sender_email, reply_to_email)
VALUES (true, 'MathGPL', '', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_email_templates (
  template_key text PRIMARY KEY,
  display_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  footer text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_email_templates TO authenticated;
GRANT ALL ON public.platform_email_templates TO service_role;
ALTER TABLE public.platform_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read email templates" ON public.platform_email_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE POLICY "Owners insert email templates" ON public.platform_email_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));
CREATE POLICY "Owners update email templates" ON public.platform_email_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

INSERT INTO public.platform_email_templates (template_key, display_name, subject, body, footer, signature) VALUES
 ('email_verification','Email Verification','Verify your MathGPL account','Hello {{name}},

Welcome to MathGPL. Please confirm your email address to activate your account.

{{verification_link}}

If you did not create this account you can safely ignore this message.','You received this message because an account was created with this address.','The MathGPL Team'),
 ('welcome','Welcome Email','Welcome to MathGPL','Hello {{name}},

Your MathGPL account is now active. You can sign in any time at {{app_url}}.

Enjoy teaching and learning mathematics.','Need help? Just reply to this email.','The MathGPL Team'),
 ('password_reset','Password Reset','Reset your MathGPL password','Hello {{name}},

Use the link below to choose a new password. The link expires in one hour.

{{reset_link}}

If you did not request this, no action is needed.','This message was sent because a password reset was requested.','The MathGPL Team'),
 ('class_invitation','Class Invitation','You have been invited to a class on MathGPL','Hello {{name}},

{{inviter_name}} has invited you to join the class {{class_name}} on MathGPL.

{{join_link}}','You received this invitation because your email was added to a class.','The MathGPL Team'),
 ('community_invitation','Community Invitation','Join the MathGPL Community','Hello {{name}},

{{inviter_name}} has invited you to the MathGPL Community, where teachers share lesson notes, adventures and assets.

{{join_link}}','You received this invitation from a MathGPL member.','The MathGPL Team'),
 ('assessment_notification','Assessment Notification','New assessment: {{assessment_name}}','Hello {{name}},

A new assessment, {{assessment_name}}, is available in {{class_name}}.

{{open_link}}','You are receiving this because you are a member of this class.','The MathGPL Team'),
 ('announcement','Announcement','{{subject_line}}','Hello {{name}},

{{message}}','You are receiving this announcement as a MathGPL member.','The MathGPL Team'),
 ('general_notification','General Notification','{{subject_line}}','Hello {{name}},

{{message}}','You are receiving this notification from MathGPL.','The MathGPL Team')
ON CONFLICT (template_key) DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
