CREATE TABLE public.integrity_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key text NOT NULL,
  run_no integer NOT NULL,
  actor uuid REFERENCES auth.users,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total integer NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  partial_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  notes text,
  UNIQUE (segment_key, run_no)
);

CREATE TABLE public.integrity_requirement_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.integrity_audit_runs(id) ON DELETE CASCADE,
  segment_key text NOT NULL,
  requirement_id text NOT NULL,
  status text NOT NULL,
  evidence text,
  reason text,
  check_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, requirement_id)
);

CREATE INDEX integrity_results_requirement_idx ON public.integrity_requirement_results (requirement_id, created_at DESC);
CREATE INDEX integrity_results_segment_idx ON public.integrity_requirement_results (segment_key);

CREATE TABLE public.integrity_repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id text NOT NULL,
  segment_key text NOT NULL,
  standard_snapshot jsonb NOT NULL,
  restoration_source text,
  scope text,
  status text NOT NULL DEFAULT 'OPEN',
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX integrity_repair_requirement_idx ON public.integrity_repair_orders (requirement_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrity_audit_runs TO authenticated;
GRANT ALL ON public.integrity_audit_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrity_requirement_results TO authenticated;
GRANT ALL ON public.integrity_requirement_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrity_repair_orders TO authenticated;
GRANT ALL ON public.integrity_repair_orders TO service_role;

ALTER TABLE public.integrity_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_requirement_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage audit runs" ON public.integrity_audit_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Admins manage audit results" ON public.integrity_requirement_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Admins manage repair orders" ON public.integrity_repair_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));