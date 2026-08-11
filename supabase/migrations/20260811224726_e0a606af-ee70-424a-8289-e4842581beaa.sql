-- 1. Canonical school container per school owner.
-- The canonical one is the school org with the most non-owner members (ties
-- broken by earliest creation): that is the container people actually joined.
WITH ranked AS (
  SELECT o.id, o.owner_user_id,
         row_number() OVER (
           PARTITION BY o.owner_user_id
           ORDER BY (SELECT count(*) FROM public.account_memberships m
                      WHERE m.org_id = o.id AND m.user_id <> o.owner_user_id) DESC,
                    o.created_at
         ) AS rn
  FROM public.organizations o
  WHERE o.kind = 'school' AND o.owner_user_id IS NOT NULL
),
canonical AS (SELECT owner_user_id, id AS keep_id FROM ranked WHERE rn = 1),
dupes AS (
  SELECT r.id AS drop_id, c.keep_id
  FROM ranked r JOIN canonical c ON c.owner_user_id = r.owner_user_id
  WHERE r.rn > 1
)
-- Repoint the data that can be moved safely.
, m1 AS (
  UPDATE public.classes c SET org_id = d.keep_id FROM dupes d WHERE c.org_id = d.drop_id RETURNING 1
), m2 AS (
  UPDATE public.notebooks n SET org_id = d.keep_id FROM dupes d WHERE n.org_id = d.drop_id RETURNING 1
), m3 AS (
  UPDATE public.games g SET org_id = d.keep_id FROM dupes d WHERE g.org_id = d.drop_id RETURNING 1
), m4 AS (
  UPDATE public.connections cn SET org_id = d.keep_id FROM dupes d WHERE cn.org_id = d.drop_id RETURNING 1
), m5 AS (
  UPDATE public.teacher_invitations ti SET org_id = d.keep_id FROM dupes d WHERE ti.org_id = d.drop_id RETURNING 1
), m6 AS (
  UPDATE public.account_ids a SET org_id = d.keep_id FROM dupes d WHERE a.org_id = d.drop_id RETURNING 1
), m7 AS (
  -- Memberships move only when the person is not already a member of the keeper.
  UPDATE public.account_memberships am SET org_id = d.keep_id
  FROM dupes d
  WHERE am.org_id = d.drop_id
    AND NOT EXISTS (SELECT 1 FROM public.account_memberships k
                     WHERE k.org_id = d.keep_id AND k.user_id = am.user_id)
  RETURNING 1
), m8 AS (
  DELETE FROM public.account_memberships am USING dupes d WHERE am.org_id = d.drop_id RETURNING 1
), m9 AS (
  UPDATE public.profiles p SET active_org_id = d.keep_id FROM dupes d WHERE p.active_org_id = d.drop_id RETURNING 1
), m10 AS (
  UPDATE public.organizations o SET parent_org_id = d.keep_id FROM dupes d WHERE o.parent_org_id = d.drop_id RETURNING 1
)
DELETE FROM public.organizations o USING dupes d WHERE o.id = d.drop_id;

-- 2. A school account operates its school container.
UPDATE public.profiles p
SET active_org_id = o.id
FROM public.organizations o
WHERE o.kind = 'school'
  AND o.owner_user_id = p.user_id
  AND (p.active_org_id IS NULL OR p.active_org_id <> o.id);

-- 3. Every accepted school-teacher connection is a real membership.
INSERT INTO public.account_memberships (user_id, org_id, role, status)
SELECT CASE WHEN public.account_role_of(c.from_user_id) = 'school' THEN c.to_user_id ELSE c.from_user_id END,
       c.org_id, 'teacher', 'active'
FROM public.connections c
WHERE c.relation = 'school_teacher' AND c.status = 'accepted' AND c.org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';

-- 4. The school's teacher list follows the accepted connections, and speaks
--    public identity (username, picture) — never an email address.
DROP FUNCTION IF EXISTS public.school_teachers(uuid);
CREATE FUNCTION public.school_teachers(_org_id uuid)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text,
              mathgpl_id text, status text, connection_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH people AS (
    SELECT m.user_id, m.status
    FROM public.account_memberships m
    WHERE m.org_id = _org_id AND m.role = 'teacher' AND m.status <> 'removed'
    UNION
    SELECT CASE WHEN public.account_role_of(c.from_user_id) = 'school'
                THEN c.to_user_id ELSE c.from_user_id END, 'active'
    FROM public.connections c
    WHERE c.org_id = _org_id AND c.relation = 'school_teacher' AND c.status = 'accepted'
  )
  SELECT p2.user_id,
         COALESCE(NULLIF(pr.display_name, ''),
                  NULLIF(trim(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''),
                  'Teacher'),
         COALESCE(pr.username, 'mathgpl'),
         pr.avatar_url,
         a.mathgpl_id,
         min(p2.status),
         COALESCE((SELECT c.status FROM public.connections c
                    WHERE c.org_id = _org_id AND c.relation = 'school_teacher'
                      AND (c.from_user_id = p2.user_id OR c.to_user_id = p2.user_id)
                    ORDER BY c.created_at DESC LIMIT 1), 'connected')
  FROM people p2
  LEFT JOIN public.profiles pr ON pr.user_id = p2.user_id
  LEFT JOIN public.account_ids a ON a.user_id = p2.user_id
  WHERE public.is_org_owner(_org_id)
  GROUP BY p2.user_id, pr.display_name, pr.first_name, pr.last_name, pr.username, pr.avatar_url, a.mathgpl_id
  ORDER BY 2;
$$;

-- 5. A school account can never end up with a second school container.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_school_per_owner
  ON public.organizations (owner_user_id)
  WHERE kind = 'school' AND owner_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_account(_requested_role text DEFAULT 'teacher'::text, _org_name text DEFAULT NULL::text)
 RETURNS TABLE(role app_role, org_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_org uuid;
  v_name text;
  m jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid) THEN
    SELECT COALESCE(u.raw_user_meta_data, '{}'::jsonb), u.email INTO m, v_email
    FROM auth.users u WHERE u.id = v_uid;

    INSERT INTO public.profiles (
      user_id, display_name, mathgpl_student_id, first_name, last_name, date_of_birth
    ) VALUES (
      v_uid,
      COALESCE(
        NULLIF(m->>'display_name',''),
        NULLIF(trim(COALESCE(m->>'first_name','') || ' ' || COALESCE(m->>'last_name','')), ''),
        NULLIF(m->>'full_name',''),
        NULLIF(m->>'name',''),
        split_part(COALESCE(v_email,''), '@', 1)
      ),
      public.generate_mathgpl_id(),
      NULLIF(m->>'first_name',''),
      NULLIF(m->>'last_name',''),
      NULLIF(m->>'date_of_birth','')::date
    ) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT public.current_role_name() INTO v_role;

  IF v_role IS NULL THEN
    IF _requested_role IN ('school','teacher','parent','student') THEN
      v_role := _requested_role::public.app_role;
    ELSE
      v_role := 'teacher';
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.account_ids a WHERE a.user_id = v_uid) THEN
    BEGIN
      PERFORM public.issue_account_id(v_uid, v_role);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- A school account has exactly one school container: never a second one.
  IF v_role = 'school' THEN
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE o.owner_user_id = v_uid AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    SELECT m2.org_id INTO v_org FROM public.account_memberships m2
    WHERE m2.user_id = v_uid AND m2.status = 'active'
    ORDER BY m2.created_at LIMIT 1;
  END IF;

  IF v_org IS NULL AND v_role IN ('school','teacher','parent') THEN
    SELECT COALESCE(NULLIF(_org_name,''), NULLIF(p.display_name,''), 'My') INTO v_name
    FROM public.profiles p WHERE p.user_id = v_uid;
    v_name := COALESCE(v_name, 'My');

    INSERT INTO public.organizations (kind, name, owner_user_id)
    VALUES (v_role::text, v_name || ' workspace', v_uid)
    RETURNING id INTO v_org;

    INSERT INTO public.account_memberships (user_id, org_id, role)
    VALUES (v_uid, v_org, v_role) ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_role, v_org;
END $function$;

GRANT EXECUTE ON FUNCTION public.school_teachers(uuid) TO authenticated;