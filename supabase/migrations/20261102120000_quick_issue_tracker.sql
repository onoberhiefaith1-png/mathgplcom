-- Quick Issue Tracker: one shared list and one high-entropy link per school.
-- Link holders can read and write through these functions. Owner/manager
-- delete and reopen stay on the signed-in school role and are never granted
-- to the anonymous link. The public link is the token column; replacing it
-- revokes the previous link.

CREATE OR REPLACE FUNCTION public.quick_issue_new_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT encode(gen_random_bytes(32), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_clean_actor(_actor text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n text := trim(coalesce(_actor, ''));
BEGIN
  IF length(n) < 1 OR length(n) > 80 THEN
    RAISE EXCEPTION 'Enter your name (1–80 characters).';
  END IF;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_actor_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(p.full_name), ''))
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
    ),
    'Owner'
  )
$$;

CREATE TABLE public.quick_issue_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quick_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tracker_id uuid NOT NULL REFERENCES public.quick_issue_trackers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 140),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 8000),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_by_name text NOT NULL,
  worker_name text,
  worker_at timestamptz,
  completer_name text,
  completed_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quick_issues_org_created_idx ON public.quick_issues (org_id, created_at DESC);

CREATE TABLE public.quick_issue_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.quick_issues(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('issue', 'completion')),
  kind text NOT NULL CHECK (kind IN ('link', 'image', 'video', 'audio', 'file')),
  label text,
  url text,
  storage_path text UNIQUE,
  mime text,
  byte_size bigint,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'link' AND url IS NOT NULL AND storage_path IS NULL)
    OR (kind <> 'link' AND storage_path IS NOT NULL AND url IS NULL)
  )
);
CREATE INDEX quick_issue_media_issue_idx ON public.quick_issue_media (issue_id);

CREATE TABLE public.quick_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.quick_issues(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('not_started', 'in_progress', 'completed')),
  actor_name text NOT NULL,
  actor_user_id uuid,
  action text NOT NULL CHECK (action IN ('created', 'in_progress', 'completed', 'reopened', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quick_issue_events_issue_idx ON public.quick_issue_events (issue_id, created_at);

GRANT SELECT ON public.quick_issue_trackers, public.quick_issues, public.quick_issue_media, public.quick_issue_events TO authenticated;
GRANT ALL ON public.quick_issue_trackers, public.quick_issues, public.quick_issue_media, public.quick_issue_events TO service_role;

ALTER TABLE public.quick_issue_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_issue_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_issue_events ENABLE ROW LEVEL SECURITY;

-- No insert/update/delete policies: every write goes through a function.
-- Anonymous link holders have no table grant, so another school's rows are
-- not readable through the API even if a token is guessed wrong.
CREATE POLICY "quick issue tracker readable by managers"
  ON public.quick_issue_trackers FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id));

CREATE POLICY "quick issues readable by managers"
  ON public.quick_issues FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.staff_is_manager(org_id));

CREATE POLICY "quick issue media readable by managers"
  ON public.quick_issue_media FOR SELECT TO authenticated
  USING (
    public.staff_is_manager(org_id)
    AND EXISTS (
      SELECT 1 FROM public.quick_issues i
      WHERE i.id = issue_id AND i.deleted_at IS NULL AND i.org_id = quick_issue_media.org_id
    )
  );

CREATE POLICY "quick issue events readable by managers"
  ON public.quick_issue_events FOR SELECT TO authenticated
  USING (
    public.staff_is_manager(org_id)
    AND EXISTS (
      SELECT 1 FROM public.quick_issues i
      WHERE i.id = issue_id AND i.deleted_at IS NULL AND i.org_id = quick_issue_events.org_id
    )
  );

CREATE OR REPLACE FUNCTION public.quick_issue_require_tracker(_token text)
RETURNS public.quick_issue_trackers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.quick_issue_trackers;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'This school link is not active.';
  END IF;
  SELECT * INTO row FROM public.quick_issue_trackers WHERE token = _token;
  IF row.id IS NULL THEN
    RAISE EXCEPTION 'This school link is not active.';
  END IF;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_ensure(_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_is_manager(_org) THEN
    RAISE EXCEPTION 'Only the school owner or a manager can open the tracker link.';
  END IF;
  INSERT INTO public.quick_issue_trackers (org_id, token, created_by)
  VALUES (_org, public.quick_issue_new_token(), auth.uid())
  ON CONFLICT (org_id) DO NOTHING;
  SELECT token INTO tok FROM public.quick_issue_trackers WHERE org_id = _org;
  IF tok IS NULL THEN
    RAISE EXCEPTION 'Only the school owner or a manager can open the tracker link.';
  END IF;
  RETURN jsonb_build_object('token', tok);
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_regenerate(_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_is_manager(_org) THEN
    RAISE EXCEPTION 'Only the school owner or a manager can change the school link.';
  END IF;
  INSERT INTO public.quick_issue_trackers (org_id, token, created_by)
  VALUES (_org, public.quick_issue_new_token(), auth.uid())
  ON CONFLICT (org_id) DO NOTHING;
  UPDATE public.quick_issue_trackers
  SET token = public.quick_issue_new_token(), updated_at = now()
  WHERE org_id = _org
  RETURNING token INTO tok;
  IF tok IS NULL THEN
    RAISE EXCEPTION 'Only the school owner or a manager can change the school link.';
  END IF;
  PERFORM public.staff_log(_org, NULL, auth.uid(), 'quick_issue_link_regenerated', '{}'::jsonb);
  RETURN tok;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_list(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  school text;
  manage boolean;
  issues_json jsonb;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  SELECT o.name INTO school FROM public.organizations o WHERE o.id = tracker.org_id;
  manage := COALESCE(auth.uid() IS NOT NULL AND public.staff_is_manager(tracker.org_id), false);

  SELECT COALESCE(jsonb_agg(s.item ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO issues_json
  FROM (
    SELECT i.created_at,
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'description', i.description,
        'status', i.status,
        'createdByName', i.created_by_name,
        'workerName', i.worker_name,
        'workerAt', i.worker_at,
        'completerName', i.completer_name,
        'completedAt', i.completed_at,
        'createdAt', i.created_at,
        'updatedAt', i.updated_at,
        'media', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id,
            'role', m.role,
            'kind', m.kind,
            'label', m.label,
            'url', m.url,
            'mime', m.mime,
            'byteSize', m.byte_size,
            'createdByName', m.created_by_name,
            'createdAt', m.created_at
          ) ORDER BY m.created_at)
          FROM public.quick_issue_media m
          WHERE m.issue_id = i.id
        ), '[]'::jsonb),
        'history', COALESCE((
          SELECT jsonb_agg(h.obj ORDER BY h.created_at)
          FROM (
            SELECT e.created_at,
              jsonb_build_object(
                'id', e.id,
                'action', e.action,
                'fromStatus', e.from_status,
                'toStatus', e.to_status,
                'actorName', e.actor_name,
                'createdAt', e.created_at
              ) AS obj
            FROM public.quick_issue_events e
            WHERE e.issue_id = i.id
            ORDER BY e.created_at DESC
            LIMIT 40
          ) h
        ), '[]'::jsonb)
      ) AS item
    FROM public.quick_issues i
    WHERE i.org_id = tracker.org_id AND i.deleted_at IS NULL
    ORDER BY i.created_at DESC
    LIMIT 500
  ) s;

  RETURN jsonb_build_object(
    'schoolName', COALESCE(school, 'School'),
    'canManage', manage,
    'orgId', CASE WHEN manage THEN tracker.org_id::text ELSE NULL END,
    'issues', issues_json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_create(_token text, _name text, _description text, _actor text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  actor text;
  title text;
  body text;
  new_id uuid;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  actor := public.quick_issue_clean_actor(_actor);
  title := trim(coalesce(_name, ''));
  IF char_length(title) < 1 OR char_length(title) > 140 THEN
    RAISE EXCEPTION 'Issue name must be 1–140 characters.';
  END IF;
  body := trim(coalesce(_description, ''));
  IF char_length(body) > 8000 THEN
    RAISE EXCEPTION 'Description is too long.';
  END IF;
  INSERT INTO public.quick_issues (org_id, tracker_id, name, description, status, created_by_name)
  VALUES (tracker.org_id, tracker.id, title, body, 'not_started', actor)
  RETURNING id INTO new_id;
  INSERT INTO public.quick_issue_events (issue_id, org_id, from_status, to_status, actor_name, actor_user_id, action)
  VALUES (new_id, tracker.org_id, NULL, 'not_started', actor, auth.uid(), 'created');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_set_status(_token text, _issue uuid, _status text, _actor text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  issue public.quick_issues;
  actor text;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  IF _status NOT IN ('in_progress', 'completed') THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  SELECT * INTO issue
  FROM public.quick_issues
  WHERE id = _issue AND org_id = tracker.org_id AND deleted_at IS NULL;
  IF issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found.';
  END IF;
  IF issue.status = 'completed' THEN
    RAISE EXCEPTION 'Only a school owner or manager can reopen a completed issue.';
  END IF;
  actor := public.quick_issue_clean_actor(_actor);
  IF _status = 'in_progress' THEN
    UPDATE public.quick_issues
    SET status = 'in_progress', worker_name = actor, worker_at = now(), updated_at = now()
    WHERE id = issue.id;
  ELSE
    UPDATE public.quick_issues
    SET status = 'completed', completer_name = actor, completed_at = now(), updated_at = now()
    WHERE id = issue.id;
  END IF;
  INSERT INTO public.quick_issue_events (issue_id, org_id, from_status, to_status, actor_name, actor_user_id, action)
  VALUES (issue.id, tracker.org_id, issue.status, _status, actor, auth.uid(), _status);
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_add_link(_token text, _issue uuid, _url text, _role text, _actor text, _label text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  issue public.quick_issues;
  actor text;
  link text;
  caption text;
  new_id uuid;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  IF _role NOT IN ('issue', 'completion') THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  SELECT * INTO issue
  FROM public.quick_issues
  WHERE id = _issue AND org_id = tracker.org_id AND deleted_at IS NULL;
  IF issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found.';
  END IF;
  IF _role = 'completion' AND issue.status <> 'completed' THEN
    RAISE EXCEPTION 'A completion attachment can be added after the issue is completed.';
  END IF;
  actor := public.quick_issue_clean_actor(_actor);
  link := trim(coalesce(_url, ''));
  IF link !~ '^https?://' OR char_length(link) > 2000 OR char_length(link) < 8 THEN
    RAISE EXCEPTION 'Enter a link starting with http:// or https://.';
  END IF;
  caption := NULLIF(left(trim(coalesce(_label, '')), 140), '');
  INSERT INTO public.quick_issue_media (issue_id, org_id, role, kind, label, url, created_by_name)
  VALUES (issue.id, tracker.org_id, _role, 'link', caption, link, actor)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_delete(_issue uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issue public.quick_issues;
  actor text;
BEGIN
  SELECT * INTO issue FROM public.quick_issues WHERE id = _issue;
  IF issue.id IS NULL OR issue.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL OR NOT public.staff_is_manager(issue.org_id) THEN
    RAISE EXCEPTION 'Only the school owner or a manager can delete an issue.';
  END IF;
  actor := public.quick_issue_actor_name();
  UPDATE public.quick_issues
  SET deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
  WHERE id = issue.id;
  INSERT INTO public.quick_issue_events (issue_id, org_id, from_status, to_status, actor_name, actor_user_id, action)
  VALUES (issue.id, issue.org_id, issue.status, issue.status, actor, auth.uid(), 'deleted');
  PERFORM public.staff_log(issue.org_id, NULL, auth.uid(), 'quick_issue_deleted', jsonb_build_object('issue', issue.id, 'name', issue.name));
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_reopen(_issue uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issue public.quick_issues;
  actor text;
BEGIN
  IF _status NOT IN ('in_progress', 'not_started') THEN
    RAISE EXCEPTION 'Reopen to In Progress or Not Started.';
  END IF;
  SELECT * INTO issue FROM public.quick_issues WHERE id = _issue AND deleted_at IS NULL;
  IF issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.staff_is_manager(issue.org_id) THEN
    RAISE EXCEPTION 'Only the school owner or a manager can reopen an issue.';
  END IF;
  IF issue.status <> 'completed' THEN
    RAISE EXCEPTION 'Only a completed issue can be reopened.';
  END IF;
  actor := public.quick_issue_actor_name();
  IF _status = 'in_progress' THEN
    UPDATE public.quick_issues
    SET status = 'in_progress', worker_name = actor, worker_at = now(), updated_at = now()
    WHERE id = issue.id;
  ELSE
    UPDATE public.quick_issues
    SET status = 'not_started', worker_name = NULL, worker_at = NULL, updated_at = now()
    WHERE id = issue.id;
  END IF;
  INSERT INTO public.quick_issue_events (issue_id, org_id, from_status, to_status, actor_name, actor_user_id, action)
  VALUES (issue.id, issue.org_id, 'completed', _status, actor, auth.uid(), 'reopened');
  PERFORM public.staff_log(
    issue.org_id, NULL, auth.uid(), 'quick_issue_reopened',
    jsonb_build_object('issue', issue.id, 'name', issue.name, 'status', _status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_prepare_upload(
  _token text,
  _issue uuid,
  _role text,
  _actor text,
  _file_name text,
  _mime text,
  _bytes bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  issue public.quick_issues;
  safe text;
  ext text;
  path text;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  IF _role NOT IN ('issue', 'completion') THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  PERFORM public.quick_issue_clean_actor(_actor);
  SELECT * INTO issue
  FROM public.quick_issues
  WHERE id = _issue AND org_id = tracker.org_id AND deleted_at IS NULL;
  IF issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found.';
  END IF;
  IF _role = 'completion' AND issue.status <> 'completed' THEN
    RAISE EXCEPTION 'A completion attachment can be added after the issue is completed.';
  END IF;
  IF _bytes IS NULL OR _bytes < 1 OR _bytes > 52428800 THEN
    RAISE EXCEPTION 'Files must be 50 MB or smaller.';
  END IF;
  safe := regexp_replace(coalesce(_file_name, 'file'), '[^A-Za-z0-9._-]+', '_', 'g');
  safe := left(safe, 80);
  IF safe = '' OR safe = '.' OR safe = '..' THEN
    safe := 'file';
  END IF;
  ext := lower(regexp_replace(safe, '^.*\.', ''));
  IF position('.' in safe) > 0 AND ext IN ('exe', 'bat', 'cmd', 'com', 'msi', 'dll', 'scr', 'ps1') THEN
    RAISE EXCEPTION 'That file type can''t be attached.';
  END IF;
  IF _mime IS NOT NULL AND char_length(_mime) > 120 THEN
    RAISE EXCEPTION 'That file type can''t be attached.';
  END IF;
  path := tracker.org_id::text || '/' || issue.id::text || '/' || gen_random_uuid()::text || '-' || safe;
  RETURN jsonb_build_object('path', path);
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_commit_upload(
  _token text,
  _issue uuid,
  _role text,
  _actor text,
  _kind text,
  _label text,
  _path text,
  _mime text,
  _bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  issue public.quick_issues;
  actor text;
  caption text;
  new_id uuid;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  IF _role NOT IN ('issue', 'completion') OR _kind NOT IN ('image', 'video', 'audio', 'file') THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  SELECT * INTO issue
  FROM public.quick_issues
  WHERE id = _issue AND org_id = tracker.org_id AND deleted_at IS NULL;
  IF issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found.';
  END IF;
  IF _role = 'completion' AND issue.status <> 'completed' THEN
    RAISE EXCEPTION 'A completion attachment can be added after the issue is completed.';
  END IF;
  IF _bytes IS NULL OR _bytes < 1 OR _bytes > 52428800 THEN
    RAISE EXCEPTION 'Files must be 50 MB or smaller.';
  END IF;
  IF _path IS NULL
    OR _path LIKE '%..%'
    OR split_part(_path, '/', 1) <> tracker.org_id::text
    OR split_part(_path, '/', 2) <> issue.id::text
    OR split_part(_path, '/', 3) !~ '^[0-9a-f-]{36}-'
  THEN
    RAISE EXCEPTION 'Invalid upload.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'quick-issue-media' AND o.name = _path
  ) THEN
    RAISE EXCEPTION 'Upload was not stored.';
  END IF;
  actor := public.quick_issue_clean_actor(_actor);
  caption := NULLIF(left(trim(coalesce(_label, '')), 140), '');
  INSERT INTO public.quick_issue_media (
    issue_id, org_id, role, kind, label, storage_path, mime, byte_size, created_by_name
  ) VALUES (
    issue.id, tracker.org_id, _role, _kind, caption, _path, NULLIF(left(coalesce(_mime, ''), 120), ''), _bytes, actor
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_issue_media_location(_token text, _media uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tracker public.quick_issue_trackers;
  path text;
  mime text;
BEGIN
  tracker := public.quick_issue_require_tracker(_token);
  SELECT m.storage_path, m.mime INTO path, mime
  FROM public.quick_issue_media m
  JOIN public.quick_issues i ON i.id = m.issue_id
  WHERE m.id = _media
    AND i.org_id = tracker.org_id
    AND i.deleted_at IS NULL
    AND m.storage_path IS NOT NULL;
  IF path IS NULL THEN
    RAISE EXCEPTION 'Attachment not found.';
  END IF;
  RETURN jsonb_build_object('path', path, 'mime', mime);
END;
$$;

REVOKE ALL ON FUNCTION public.quick_issue_new_token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_clean_actor(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_actor_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_require_tracker(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_ensure(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_regenerate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_list(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_create(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_set_status(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_add_link(text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_reopen(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_prepare_upload(text, uuid, text, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_commit_upload(text, uuid, text, text, text, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_issue_media_location(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.quick_issue_storage_allowed(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _name IS NOT NULL
    AND _name !~ '\.\.'
    AND EXISTS (
      SELECT 1
      FROM public.quick_issues i
      WHERE i.deleted_at IS NULL
        AND i.org_id::text = split_part(_name, '/', 1)
        AND i.id::text = split_part(_name, '/', 2)
        AND split_part(_name, '/', 3) <> ''
    )
$$;

REVOKE ALL ON FUNCTION public.quick_issue_storage_allowed(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.quick_issue_ensure(uuid), public.quick_issue_regenerate(uuid),
  public.quick_issue_list(text), public.quick_issue_create(text, text, text, text),
  public.quick_issue_set_status(text, uuid, text, text),
  public.quick_issue_add_link(text, uuid, text, text, text, text),
  public.quick_issue_delete(uuid), public.quick_issue_reopen(uuid, text),
  public.quick_issue_prepare_upload(text, uuid, text, text, text, text, bigint),
  public.quick_issue_commit_upload(text, uuid, text, text, text, text, text, text, text, bigint),
  public.quick_issue_media_location(text, uuid),
  public.quick_issue_storage_allowed(text)
  TO authenticated;

-- The school link can report, attach media, and move an issue to In Progress
-- or Completed. It cannot delete, reopen, or mint a new link.
GRANT EXECUTE ON FUNCTION public.quick_issue_list(text), public.quick_issue_create(text, text, text, text),
  public.quick_issue_set_status(text, uuid, text, text),
  public.quick_issue_add_link(text, uuid, text, text, text, text),
  public.quick_issue_prepare_upload(text, uuid, text, text, text, text, bigint),
  public.quick_issue_commit_upload(text, uuid, text, text, text, text, text, text, bigint),
  public.quick_issue_media_location(text, uuid),
  public.quick_issue_storage_allowed(text)
  TO anon;

GRANT EXECUTE ON FUNCTION public.quick_issue_new_token(), public.quick_issue_clean_actor(text),
  public.quick_issue_actor_name(), public.quick_issue_require_tracker(text),
  public.quick_issue_ensure(uuid), public.quick_issue_regenerate(uuid),
  public.quick_issue_list(text), public.quick_issue_create(text, text, text, text),
  public.quick_issue_set_status(text, uuid, text, text),
  public.quick_issue_add_link(text, uuid, text, text, text, text),
  public.quick_issue_delete(uuid), public.quick_issue_reopen(uuid, text),
  public.quick_issue_prepare_upload(text, uuid, text, text, text, text, bigint),
  public.quick_issue_commit_upload(text, uuid, text, text, text, text, text, text, text, bigint),
  public.quick_issue_media_location(text, uuid),
  public.quick_issue_storage_allowed(text)
  TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quick-issue-media', 'quick-issue-media', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Private bucket. A path is writable or readable only when it names a live
-- issue. Listing and attaching still require the school token in the RPCs.
CREATE POLICY "quick issue media insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'quick-issue-media' AND public.quick_issue_storage_allowed(name));

CREATE POLICY "quick issue media read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'quick-issue-media' AND public.quick_issue_storage_allowed(name));

ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_issues, public.quick_issue_media, public.quick_issue_events;
