INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, 'create_lesson_notes' FROM public.plans p
WHERE p.key = 'teacher_free'
  AND NOT EXISTS (SELECT 1 FROM public.plan_entitlements pe WHERE pe.plan_id = p.id AND pe.feature_key = 'create_lesson_notes');

INSERT INTO public.subscription_entitlements (subscription_id, feature_key)
SELECT s.id, 'create_lesson_notes' FROM public.subscriptions s
JOIN public.plans p ON p.id::text = s.plan_id::text
WHERE p.key = 'teacher_free'
  AND EXISTS (SELECT 1 FROM public.subscription_entitlements se WHERE se.subscription_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.subscription_entitlements se WHERE se.subscription_id = s.id AND se.feature_key = 'create_lesson_notes');