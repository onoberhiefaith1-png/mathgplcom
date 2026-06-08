
-- 1) Hide join_code from class members (owners still read it via SECURITY DEFINER RPCs)
REVOKE SELECT ON public.classes FROM authenticated;
GRANT SELECT (id, owner_id, name, class_code, smartboard_visibility, created_at, updated_at)
  ON public.classes TO authenticated;

-- 2) Tighten profiles SELECT
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.shares_class_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- I own a class the other user is a member of
    SELECT 1 FROM public.classes c
    JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = auth.uid() AND m.user_id = _other
  ) OR EXISTS (
    -- The other user owns a class I'm a member of
    SELECT 1 FROM public.classes c
    JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = _other AND m.user_id = auth.uid()
  ) OR EXISTS (
    -- We are both members of the same class
    SELECT 1 FROM public.class_members a
    JOIN public.class_members b ON a.class_id = b.class_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  ) OR EXISTS (
    -- The other user has a pending/any request to a class I own
    SELECT 1 FROM public.class_join_requests r
    JOIN public.classes c ON c.id = r.class_id
    WHERE c.owner_id = auth.uid() AND r.requester_id = _other
  );
$$;

CREATE POLICY "Users read own or classmate profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.shares_class_with(user_id));

-- 3) Allow owners to look up a student by MathGPL ID to send invitations
CREATE OR REPLACE FUNCTION public.lookup_profile_by_student_id(_student_id text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.mathgpl_student_id = upper(_student_id)
  LIMIT 1;
$$;
