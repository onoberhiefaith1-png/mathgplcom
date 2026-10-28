INSERT INTO public.archived_features (feature_key, display_name, archived)
VALUES ('aura_assistant', 'Aura Assistant', true)
ON CONFLICT (feature_key) DO UPDATE SET archived = true;