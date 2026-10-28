REVOKE SELECT (credit_cost, profit_percentage, platform_amount, credit_sell_price)
  ON public.plan_versions FROM anon, authenticated;