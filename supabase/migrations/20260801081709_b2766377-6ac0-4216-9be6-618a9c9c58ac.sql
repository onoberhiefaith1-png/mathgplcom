ALTER TABLE public.platform_email_templates
  ADD COLUMN IF NOT EXISTS heading_color TEXT NOT NULL DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#334155',
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS button_label TEXT NOT NULL DEFAULT 'Continue',
  ADD COLUMN IF NOT EXISTS logo_text TEXT NOT NULL DEFAULT 'MathGPL';

CREATE TABLE IF NOT EXISTS public.platform_email_senders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL UNIQUE,
  reply_to_email TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_email_senders TO authenticated;
GRANT ALL ON public.platform_email_senders TO service_role;

ALTER TABLE public.platform_email_senders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform owner manages senders" ON public.platform_email_senders;
CREATE POLICY "Platform owner manages senders"
ON public.platform_email_senders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner'))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

DROP TRIGGER IF EXISTS update_platform_email_senders_updated_at ON public.platform_email_senders;
CREATE TRIGGER update_platform_email_senders_updated_at
BEFORE UPDATE ON public.platform_email_senders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();