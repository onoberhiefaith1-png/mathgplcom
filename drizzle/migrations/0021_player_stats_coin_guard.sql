CREATE OR REPLACE FUNCTION public.player_stats_coin_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  allowed integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.coins := GREATEST(COALESCE(NEW.coins, 0), 0);
  IF TG_OP = 'INSERT' THEN
    NEW.coins := LEAST(NEW.coins, 50);
  ELSE
    -- Coins can only grow at a realistic in-game pace, measured by the server clock.
    allowed := COALESCE(OLD.coins, 0) + GREATEST(10,
      LEAST(500, (EXTRACT(EPOCH FROM (now() - COALESCE(OLD.updated_at, now() - interval '1 minute'))) * 2)::int));
    NEW.coins := LEAST(NEW.coins, allowed);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS player_stats_coin_guard ON public.player_stats;
CREATE TRIGGER player_stats_coin_guard BEFORE INSERT OR UPDATE ON public.player_stats
FOR EACH ROW EXECUTE FUNCTION public.player_stats_coin_guard();