INSERT INTO public.archived_features (feature_key, display_name, archived)
VALUES ('game_pro', 'Game Pro (3D Game)', true)
ON CONFLICT (feature_key) DO UPDATE SET archived = true, display_name = EXCLUDED.display_name;
