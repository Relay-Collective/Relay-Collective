-- Feedback & Suggestions: product feedback from every signed-in workspace, managed in the admin console.
-- Not the same thing as ride_feedback, which is about one finished ride.
--
-- Tables
--   feedback_submissions     one piece of feedback. Only submit_feedback() creates one; only platform admins
--                            change its status, priority or assignment, through update_feedback_triage().
--   feedback_messages        replies on a submission. public: the submitter reads it; internal: admins only.
--   feedback_attachments     one optional screenshot per submission, as a path in the private
--                            feedback-attachments bucket. The row is also the upload grant: Storage accepts
--                            exactly that path, from the submitter, for an hour, once.
--   feedback_status_history  every status change, written by a trigger so no screen can forget it.
--
-- Access
--   * The browser has no insert, update or delete on any of these tables. Every write is a function that
--     checks who is calling. RLS picks rows, not columns, so column grants keep priority, assignment and
--     who-changed-what out of the browser's reach; admins read those through the admin_* functions.
--   * Submitters read their own submissions, the public replies on them, their status history and their
--     screenshot. Organization roles get nothing extra: colleagues can't read each other's feedback.
--   * Identity is the caller's profile (private.my_profile_id()). The organization comes from that profile,
--     never from the browser.
--
-- Retention
--   Profiles are deactivated, never deleted, so feedback outlives a closed account (the admin console shows
--   it as a closed account). Nothing cascades: a future retention purge must delete messages, history and
--   the attachment row (and its Storage object, through the Storage API) before the submission.

-- ---------------------------------------------------------------------------
-- feedback_submissions
-- ---------------------------------------------------------------------------

create table public.feedback_submissions (
  id                uuid primary key default gen_random_uuid(),
  reference         bigint generated always as identity unique,   -- "FB-1042": easy to quote, searchable
  client_request_id uuid not null,                                  -- one per form, so a retried send can't post twice
  submitted_by      uuid not null references public.profiles (id),
  organization_id   uuid references public.organizations (id),      -- the submitter's organization when they sent it
  feedback_type     text not null
                      check (feedback_type in ('bug', 'feature_request', 'improvement', 'release_feedback', 'general')),
  title             text not null check (char_length(title) between 1 and 150 and title = btrim(title)),
  description       text not null check (char_length(description) between 1 and 5000 and description = btrim(description)),
  -- An app route with ids blanked out, e.g. /workspace/transportation/rides/:id. Never a full URL.
  source_page       text check (source_page is null or source_page ~ '^/[A-Za-z0-9/_.:-]{0,199}$'),
  source_workspace  text not null check (source_workspace in ('organization', 'volunteer', 'driver', 'admin')),
  -- A version from the app's What's New list (src/changelog.ts). There is no releases table to point at.
  related_release   text check (related_release is null or related_release ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  status            text not null default 'new'
                      check (status in ('new', 'under_review', 'planned', 'in_progress', 'resolved', 'closed')),
  priority          text check (priority is null or priority in ('low', 'medium', 'high', 'critical')),
  assigned_to       uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  constraint feedback_submissions_request_once unique (submitted_by, client_request_id),
  constraint feedback_submissions_resolved_when_done check ((status in ('resolved', 'closed')) = (resolved_at is not null)),
  constraint feedback_submissions_release_only_for_updates check (related_release is null or feedback_type = 'release_feedback')
);

create index feedback_submissions_submitted_by_idx on public.feedback_submissions (submitted_by, created_at desc);
create index feedback_submissions_created_at_idx on public.feedback_submissions (created_at desc);
create index feedback_submissions_status_idx on public.feedback_submissions (status, created_at desc);
create index feedback_submissions_type_idx on public.feedback_submissions (feedback_type);
create index feedback_submissions_priority_idx on public.feedback_submissions (priority);
create index feedback_submissions_workspace_idx on public.feedback_submissions (source_workspace);
create index feedback_submissions_organization_idx on public.feedback_submissions (organization_id);
create index feedback_submissions_assigned_to_idx on public.feedback_submissions (assigned_to);
create index feedback_submissions_release_idx on public.feedback_submissions (related_release) where related_release is not null;

-- ---------------------------------------------------------------------------
-- feedback_messages
-- ---------------------------------------------------------------------------

create table public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback_submissions (id),
  author_id   uuid not null references public.profiles (id),
  message     text not null check (char_length(message) between 1 and 5000 and message = btrim(message)),
  visibility  text not null check (visibility in ('public', 'internal')),
  created_at  timestamptz not null default now()
);

create index feedback_messages_feedback_idx on public.feedback_messages (feedback_id, created_at);

-- ---------------------------------------------------------------------------
-- feedback_attachments
-- ---------------------------------------------------------------------------

create table public.feedback_attachments (
  id           uuid primary key default gen_random_uuid(),
  feedback_id  uuid not null unique references public.feedback_submissions (id), -- one screenshot per submission for now
  uploaded_by  uuid not null references public.profiles (id),
  -- <feedback id>/<random uuid>.<ext>. Chosen by begin_feedback_attachment, never by the browser.
  storage_path text not null unique
                 check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  file_name    text not null check (char_length(file_name) between 1 and 120), -- display only
  mime_type    text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  file_size    integer not null check (file_size between 1 and 5242880),
  created_at   timestamptz not null default now(), -- also when the upload grant was (last) issued
  uploaded_at  timestamptz,                        -- the file is in Storage
  constraint feedback_attachments_path_in_folder check (split_part(storage_path, '/', 1) = feedback_id::text)
);

-- ---------------------------------------------------------------------------
-- feedback_status_history
-- ---------------------------------------------------------------------------

create table public.feedback_status_history (
  id              bigint generated always as identity primary key,
  feedback_id     uuid not null references public.feedback_submissions (id),
  previous_status text,                                   -- null: the submission itself
  new_status      text not null,
  changed_by      uuid references public.profiles (id),   -- null: Relay Collective itself (e.g. a server job)
  changed_at      timestamptz not null default clock_timestamp()
);

create index feedback_status_history_feedback_idx on public.feedback_status_history (feedback_id, id);

-- ---------------------------------------------------------------------------
-- Triggers: timestamps and status history are kept by the database, not the screens
-- ---------------------------------------------------------------------------

create function private.feedback_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
    new.resolved_at := now();
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_at := null; -- reopened
  end if;
  return new;
end;
$$;

create function private.log_feedback_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.feedback_status_history (feedback_id, previous_status, new_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, private.my_profile_id());
  end if;
  return null;
end;
$$;

revoke execute on function private.feedback_before_update() from public;
revoke execute on function private.log_feedback_status() from public;

create trigger feedback_submissions_before_update before update on public.feedback_submissions
  for each row execute function private.feedback_before_update();
create trigger feedback_submissions_log_status after insert or update of status on public.feedback_submissions
  for each row execute function private.log_feedback_status();

-- ---------------------------------------------------------------------------
-- Grants and row access. Start from nothing (Supabase's default privileges grant everything on new tables).
-- ---------------------------------------------------------------------------

revoke all on public.feedback_submissions, public.feedback_messages, public.feedback_attachments, public.feedback_status_history
  from anon, authenticated;

-- priority, assigned_to and client_request_id are left out: admins read them through admin_get_feedback
grant select (id, reference, submitted_by, organization_id, feedback_type, title, description, source_page,
              source_workspace, related_release, status, created_at, updated_at, resolved_at)
  on public.feedback_submissions to authenticated;
-- author_id is left out: a submitter hears from "the Relay Collective team", not a named admin
grant select (id, feedback_id, message, visibility, created_at) on public.feedback_messages to authenticated;
grant select (id, feedback_id, storage_path, file_name, mime_type, file_size, created_at, uploaded_at)
  on public.feedback_attachments to authenticated;
grant select (id, feedback_id, previous_status, new_status, changed_at) on public.feedback_status_history to authenticated;

alter table public.feedback_submissions enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.feedback_attachments enable row level security;
alter table public.feedback_status_history enable row level security;

-- Is this submission the caller's own? SECURITY DEFINER so the policies below don't re-enter each other's RLS.
create function private.feedback_is_mine(p_feedback_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.feedback_submissions f
    where f.id = p_feedback_id and f.submitted_by = private.my_profile_id()
  )
$$;

create policy feedback_submissions_select on public.feedback_submissions
  for select to authenticated
  using ((select private.is_admin()) or submitted_by = (select private.my_profile_id()));

-- Internal notes never reach a submitter, whatever the screen asks for
create policy feedback_messages_select on public.feedback_messages
  for select to authenticated
  using ((select private.is_admin()) or (visibility = 'public' and private.feedback_is_mine(feedback_id)));

create policy feedback_attachments_select on public.feedback_attachments
  for select to authenticated
  using ((select private.is_admin()) or private.feedback_is_mine(feedback_id));

create policy feedback_status_history_select on public.feedback_status_history
  for select to authenticated
  using ((select private.is_admin()) or private.feedback_is_mine(feedback_id));

-- ---------------------------------------------------------------------------
-- Sending feedback
-- ---------------------------------------------------------------------------

-- Saves the caller's feedback and returns its id. Messages match src/feedback/rules.ts.
-- Safe to repeat with the same p_client_request_id: a retry gets the first submission back.
create function public.submit_feedback(
  p_client_request_id uuid,
  p_type text,
  p_title text,
  p_description text,
  p_source_page text default null,
  p_source_workspace text default null,
  p_related_release text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me public.profiles;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_page text;
  v_workspace text;
  v_release text;
  v_id uuid;
begin
  select * into v_me from public.profiles where id = private.my_profile_id();
  if v_me.id is null then
    raise exception 'Please sign in to send feedback.' using errcode = 'P0001';
  end if;
  if p_client_request_id is null then
    raise exception 'Something went wrong preparing your feedback. Please try again.' using errcode = 'P0001';
  end if;

  select f.id into v_id from public.feedback_submissions f
  where f.submitted_by = v_me.id and f.client_request_id = p_client_request_id;
  if v_id is not null then
    return v_id;
  end if;

  if p_type is null or p_type not in ('bug', 'feature_request', 'improvement', 'release_feedback', 'general') then
    raise exception 'Choose what kind of feedback this is.' using errcode = 'P0001';
  end if;
  if v_title = '' then
    raise exception 'Add a short title.' using errcode = 'P0001';
  end if;
  if char_length(v_title) > 150 then
    raise exception 'Keep the title to 150 characters or fewer.' using errcode = 'P0001';
  end if;
  if v_description = '' then
    raise exception 'Tell us a little more in the description.' using errcode = 'P0001';
  end if;
  if char_length(v_description) > 5000 then
    raise exception 'Keep the description to 5,000 characters or fewer.' using errcode = 'P0001';
  end if;

  -- The workspace follows from the role. A driver may say the feedback is about driving.
  v_workspace := case
    when v_me.role = 'PLATFORM_ADMIN' then 'admin'
    when v_me.role = 'DRIVER' and p_source_workspace = 'driver' then 'driver'
    when v_me.role = 'DRIVER' then 'volunteer'
    else 'organization'
  end;

  -- Only an app route, without its query or fragment and with ids blanked out. Anything else is dropped.
  v_page := split_part(split_part(coalesce(p_source_page, ''), '?', 1), '#', 1);
  v_page := regexp_replace(v_page, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'gi');
  if v_page !~ '^/[A-Za-z0-9/_.:-]{0,199}$' then
    v_page := null;
  end if;

  v_release := case when p_type = 'release_feedback' and p_related_release ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
                    then p_related_release end;

  -- A guard against floods (a stuck button, a script), not a quota anyone should meet
  if (select count(*) from public.feedback_submissions f
      where f.submitted_by = v_me.id and f.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve sent a lot of feedback in the last hour. Please try again a little later.' using errcode = 'P0001';
  end if;

  insert into public.feedback_submissions (
    client_request_id, submitted_by, organization_id, feedback_type, title, description,
    source_page, source_workspace, related_release
  )
  values (p_client_request_id, v_me.id, v_me.org_id, p_type, v_title, v_description, v_page, v_workspace, v_release)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    -- Two sends of the same form raced each other: both get the first one
    select f.id into v_id from public.feedback_submissions f
    where f.submitted_by = v_me.id and f.client_request_id = p_client_request_id;
    return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Screenshots: grant, upload to Storage, confirm
-- ---------------------------------------------------------------------------

-- Issues (or renews) the upload grant for the caller's own, recent submission and returns where to upload.
-- The path and extension are decided here from the checked type, never from the file's name.
create function public.begin_feedback_attachment(p_feedback_id uuid, p_file_name text, p_mime_type text, p_file_size integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.my_profile_id();
  v_feedback public.feedback_submissions;
  v_existing public.feedback_attachments;
  v_ext text;
  v_name text;
  v_row public.feedback_attachments;
begin
  select * into v_feedback from public.feedback_submissions where id = p_feedback_id;
  if v_me is null or v_feedback.id is null or v_feedback.submitted_by <> v_me then
    raise exception 'You can only add a screenshot to your own feedback.' using errcode = 'P0001';
  end if;
  if v_feedback.created_at < now() - interval '24 hours' then
    raise exception 'Screenshots can only be added within a day of sending feedback.' using errcode = 'P0001';
  end if;
  v_ext := case p_mime_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' end;
  if v_ext is null then
    raise exception 'Choose a PNG, JPEG or WebP image.' using errcode = 'P0001';
  end if;
  if p_file_size is null or p_file_size < 1 or p_file_size > 5242880 then
    raise exception 'Choose an image of 5 MB or less.' using errcode = 'P0001';
  end if;

  -- Display name only: no folders, no control characters
  v_name := regexp_replace(coalesce(p_file_name, ''), '^.*[/\\]', '');
  v_name := btrim(regexp_replace(v_name, '[[:cntrl:]]', '', 'g'));
  v_name := left(coalesce(nullif(v_name, ''), 'screenshot.' || v_ext), 120);

  select * into v_existing from public.feedback_attachments where feedback_id = p_feedback_id for update;
  if v_existing.uploaded_at is not null then
    raise exception 'This feedback already has a screenshot.' using errcode = 'P0001';
  end if;

  if v_existing.id is null then
    insert into public.feedback_attachments (feedback_id, uploaded_by, storage_path, file_name, mime_type, file_size)
    values (p_feedback_id, v_me, p_feedback_id::text || '/' || gen_random_uuid()::text || '.' || v_ext, v_name, p_mime_type, p_file_size)
    returning * into v_row;
  else
    -- A retry. Same type: same path, in case the first upload landed but its confirmation didn't.
    update public.feedback_attachments
       set file_name = v_name,
           mime_type = p_mime_type,
           file_size = p_file_size,
           created_at = now(),
           storage_path = case when mime_type = p_mime_type then storage_path
                               else p_feedback_id::text || '/' || gen_random_uuid()::text || '.' || v_ext end
     where id = v_existing.id
    returning * into v_row;
  end if;

  return jsonb_build_object('id', v_row.id, 'storagePath', v_row.storage_path);
end;
$$;

-- The browser says the upload finished; the database checks the file really is in Storage.
create function public.confirm_feedback_attachment(p_attachment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.feedback_attachments;
begin
  select * into v_row from public.feedback_attachments where id = p_attachment_id for update;
  if v_row.id is null or v_row.uploaded_by is distinct from private.my_profile_id() then
    raise exception 'You can only add a screenshot to your own feedback.' using errcode = 'P0001';
  end if;
  if v_row.uploaded_at is not null then
    return;
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'feedback-attachments' and o.name = v_row.storage_path) then
    raise exception 'The screenshot hasn''t finished uploading. Please try again.' using errcode = 'P0001';
  end if;
  update public.feedback_attachments set uploaded_at = now() where id = v_row.id;
end;
$$;

-- Storage policy helpers: Storage passes the object's name (its path in the bucket)
create function private.can_upload_feedback_attachment(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.feedback_attachments a
    where a.storage_path = p_name
      and a.uploaded_by = private.my_profile_id()
      and a.uploaded_at is null
      and a.created_at > now() - interval '1 hour'
  )
$$;

create function private.can_read_feedback_attachment(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.feedback_attachments a
    join public.feedback_submissions f on f.id = a.feedback_id
    where a.storage_path = p_name
      and (private.is_admin() or f.submitted_by = private.my_profile_id())
  )
$$;

-- ---------------------------------------------------------------------------
-- Managing feedback (platform admins)
-- ---------------------------------------------------------------------------

-- Changes one triage field. p_expected is what the admin's screen showed: if another admin has changed it
-- since, nothing is saved and they're asked to look again. The status trigger writes the history.
create function public.update_feedback_triage(p_feedback_id uuid, p_field text, p_expected text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.feedback_submissions;
  v_conflict constant text := 'Another admin changed this feedback a moment ago. Check the latest details, then try again.';
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can manage feedback.' using errcode = 'P0001';
  end if;
  select * into v_row from public.feedback_submissions where id = p_feedback_id for update;
  if v_row.id is null then
    raise exception 'Feedback not found.' using errcode = 'P0001';
  end if;

  if p_field = 'status' then
    if p_value is null or p_value not in ('new', 'under_review', 'planned', 'in_progress', 'resolved', 'closed') then
      raise exception 'Choose a status.' using errcode = 'P0001';
    end if;
    if v_row.status is distinct from p_expected then
      raise exception '%', v_conflict using errcode = 'P0001';
    end if;
    if v_row.status <> p_value then
      update public.feedback_submissions set status = p_value where id = p_feedback_id;
    end if;
  elsif p_field = 'priority' then
    if p_value is not null and p_value not in ('low', 'medium', 'high', 'critical') then
      raise exception 'Choose a priority.' using errcode = 'P0001';
    end if;
    if v_row.priority is distinct from p_expected then
      raise exception '%', v_conflict using errcode = 'P0001';
    end if;
    if v_row.priority is distinct from p_value then
      update public.feedback_submissions set priority = p_value where id = p_feedback_id;
    end if;
  elsif p_field = 'assigned_to' then
    if p_value is not null and (
      p_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (select 1 from public.profiles p where p.id = p_value::uuid and p.role = 'PLATFORM_ADMIN' and p.is_active)
    ) then
      raise exception 'Feedback can only be assigned to a Relay Collective admin.' using errcode = 'P0001';
    end if;
    if v_row.assigned_to::text is distinct from p_expected then
      raise exception '%', v_conflict using errcode = 'P0001';
    end if;
    if v_row.assigned_to::text is distinct from p_value then
      update public.feedback_submissions set assigned_to = p_value::uuid where id = p_feedback_id;
    end if;
  else
    raise exception 'That can''t be changed here.' using errcode = 'P0001';
  end if;
end;
$$;

-- A reply to the submitter (public) or a note for other admins (internal). Admins only.
create function public.add_feedback_message(p_feedback_id uuid, p_message text, p_visibility text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can reply to feedback.' using errcode = 'P0001';
  end if;
  if p_visibility is null or p_visibility not in ('public', 'internal') then
    raise exception 'Choose who can see this message.' using errcode = 'P0001';
  end if;
  if v_message = '' then
    raise exception 'Write a message first.' using errcode = 'P0001';
  end if;
  if char_length(v_message) > 5000 then
    raise exception 'Keep the message to 5,000 characters or fewer.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.feedback_submissions where id = p_feedback_id) then
    raise exception 'Feedback not found.' using errcode = 'P0001';
  end if;

  insert into public.feedback_messages (feedback_id, author_id, message, visibility)
  values (p_feedback_id, private.my_profile_id(), v_message, p_visibility)
  returning id into v_id;
  -- A reply is news for the submitter: their list shows it as updated
  if p_visibility = 'public' then
    update public.feedback_submissions set updated_at = now() where id = p_feedback_id;
  end if;
  return v_id;
end;
$$;

-- Headline counts for the admin console, straight from the table
create function public.admin_feedback_summary()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can see feedback.' using errcode = 'P0001';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'new', count(*) filter (where status = 'new'),
      'underReview', count(*) filter (where status = 'under_review'),
      'planned', count(*) filter (where status = 'planned'),
      'inProgress', count(*) filter (where status = 'in_progress'),
      'resolved', count(*) filter (where status = 'resolved'),
      'closed', count(*) filter (where status = 'closed')
    )
    from public.feedback_submissions
  );
end;
$$;

-- One page of the feedback inbox, filtered and searched in the database. p_filters keys (all optional):
-- search, type, status, priority ('none' for unset), workspace, organizationId, release, from, to (YYYY-MM-DD).
create function public.admin_list_feedback(p_filters jsonb default '{}', p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_filters ->> 'search', '')), '');
  v_pattern text;
  v_reference bigint;
  v_from date;
  v_to date;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can see feedback.' using errcode = 'P0001';
  end if;
  begin
    v_from := nullif(p_filters ->> 'from', '')::date;
    v_to := nullif(p_filters ->> 'to', '')::date;
  exception when others then
    raise exception 'Check the dates and try again.' using errcode = 'P0001';
  end;
  if v_search is not null then
    v_search := left(v_search, 200);
    -- "FB-1042" or "1042" finds that reference; words are matched literally
    if v_search ~* '^(fb-?)?[0-9]{1,15}$' then
      v_reference := regexp_replace(v_search, '[^0-9]', '', 'g')::bigint;
    end if;
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with matching as (
    select f.*
    from public.feedback_submissions f
    where (p_filters ->> 'type' is null or f.feedback_type = p_filters ->> 'type')
      and (p_filters ->> 'status' is null or f.status = p_filters ->> 'status')
      and (p_filters ->> 'priority' is null
           or (p_filters ->> 'priority' = 'none' and f.priority is null)
           or f.priority = p_filters ->> 'priority')
      and (p_filters ->> 'workspace' is null or f.source_workspace = p_filters ->> 'workspace')
      and (p_filters ->> 'organizationId' is null or f.organization_id::text = p_filters ->> 'organizationId')
      and (p_filters ->> 'release' is null or f.related_release = p_filters ->> 'release')
      and (v_from is null or f.created_at >= v_from::timestamptz)
      and (v_to is null or f.created_at < (v_to + 1)::timestamptz)
      and (v_search is null
           or f.reference = v_reference
           or f.title ilike v_pattern
           or f.description ilike v_pattern)
  ),
  shown as (
    select m.* from matching m order by m.created_at desc, m.reference desc limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'reference', s.reference,
        'feedbackType', s.feedback_type,
        'title', s.title,
        'sourcePage', s.source_page,
        'sourceWorkspace', s.source_workspace,
        'relatedRelease', s.related_release,
        'status', s.status,
        'priority', s.priority,
        'createdAt', s.created_at,
        'updatedAt', s.updated_at,
        'resolvedAt', s.resolved_at,
        'submittedBy', jsonb_build_object('id', p.id, 'name', p.name, 'active', p.is_active),
        'organization', case when o.id is not null then jsonb_build_object('id', o.id, 'name', o.name) end,
        'assignedTo', case when a.id is not null then jsonb_build_object('id', a.id, 'name', a.name) end,
        'hasAttachment', exists (select 1 from public.feedback_attachments x where x.feedback_id = s.id and x.uploaded_at is not null)
      ) order by s.created_at desc, s.reference desc)
      from shown s
      join public.profiles p on p.id = s.submitted_by
      left join public.organizations o on o.id = s.organization_id
      left join public.profiles a on a.id = s.assigned_to
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Everything about one submission for the admin console, including internal notes and who did what
create function public.admin_get_feedback(p_feedback_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can see feedback.' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'id', f.id,
    'reference', f.reference,
    'feedbackType', f.feedback_type,
    'title', f.title,
    'description', f.description,
    'sourcePage', f.source_page,
    'sourceWorkspace', f.source_workspace,
    'relatedRelease', f.related_release,
    'status', f.status,
    'priority', f.priority,
    'createdAt', f.created_at,
    'updatedAt', f.updated_at,
    'resolvedAt', f.resolved_at,
    'submittedBy', jsonb_build_object('id', p.id, 'name', p.name, 'active', p.is_active, 'role', p.role,
                                      'email', (select u.email from auth.users u where u.id = p.auth_user_id)),
    'organization', case when o.id is not null then jsonb_build_object('id', o.id, 'name', o.name) end,
    'assignedTo', case when a.id is not null then jsonb_build_object('id', a.id, 'name', a.name) end,
    'attachment', (
      select jsonb_build_object('id', x.id, 'storagePath', x.storage_path, 'fileName', x.file_name,
                                'mimeType', x.mime_type, 'fileSize', x.file_size, 'uploadedAt', x.uploaded_at)
      from public.feedback_attachments x where x.feedback_id = f.id
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'message', m.message, 'visibility', m.visibility,
                                          'createdAt', m.created_at, 'authorName', ap.name) order by m.created_at, m.id)
      from public.feedback_messages m left join public.profiles ap on ap.id = m.author_id
      where m.feedback_id = f.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id::text, 'previousStatus', h.previous_status, 'newStatus', h.new_status,
                                          'changedAt', h.changed_at, 'changedByName', cp.name) order by h.id)
      from public.feedback_status_history h left join public.profiles cp on cp.id = h.changed_by
      where h.feedback_id = f.id
    ), '[]'::jsonb)
  ) into v_result
  from public.feedback_submissions f
  join public.profiles p on p.id = f.submitted_by
  left join public.organizations o on o.id = f.organization_id
  left join public.profiles a on a.id = f.assigned_to
  where f.id = p_feedback_id;
  return v_result; -- null: not found
end;
$$;

-- Who feedback can be assigned to: active platform admins
create function public.admin_feedback_assignees()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can manage feedback.' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
    from public.profiles p where p.role = 'PLATFORM_ADMIN' and p.is_active
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for screenshots. Limits are enforced by Storage itself as well as above.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-attachments', 'feedback-attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload: only the exact path a grant names, by its submitter, while the grant is fresh. With no update
-- policy, nobody can overwrite (upsert) a file; with no delete policy, nobody can remove one from the browser.
create policy feedback_attachments_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback-attachments' and private.can_upload_feedback_attachment(name));

-- Read (signed URLs and downloads): the submitter and platform admins
create policy feedback_attachments_read on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback-attachments' and private.can_read_feedback_attachment(name));

-- ---------------------------------------------------------------------------
-- Execute permissions: signed-in users only. Policy helpers are callable by the roles policies run as.
-- ---------------------------------------------------------------------------

revoke execute on function private.feedback_is_mine(uuid) from public;
revoke execute on function private.can_upload_feedback_attachment(text) from public;
revoke execute on function private.can_read_feedback_attachment(text) from public;
grant execute on function private.feedback_is_mine(uuid) to authenticated;
grant execute on function private.can_upload_feedback_attachment(text) to authenticated;
grant execute on function private.can_read_feedback_attachment(text) to authenticated;

revoke execute on function public.submit_feedback(uuid, text, text, text, text, text, text) from public, anon;
revoke execute on function public.begin_feedback_attachment(uuid, text, text, integer) from public, anon;
revoke execute on function public.confirm_feedback_attachment(uuid) from public, anon;
revoke execute on function public.update_feedback_triage(uuid, text, text, text) from public, anon;
revoke execute on function public.add_feedback_message(uuid, text, text) from public, anon;
revoke execute on function public.admin_feedback_summary() from public, anon;
revoke execute on function public.admin_list_feedback(jsonb, integer, integer) from public, anon;
revoke execute on function public.admin_get_feedback(uuid) from public, anon;
revoke execute on function public.admin_feedback_assignees() from public, anon;

grant execute on function public.submit_feedback(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.begin_feedback_attachment(uuid, text, text, integer) to authenticated;
grant execute on function public.confirm_feedback_attachment(uuid) to authenticated;
grant execute on function public.update_feedback_triage(uuid, text, text, text) to authenticated;
grant execute on function public.add_feedback_message(uuid, text, text) to authenticated;
grant execute on function public.admin_feedback_summary() to authenticated;
grant execute on function public.admin_list_feedback(jsonb, integer, integer) to authenticated;
grant execute on function public.admin_get_feedback(uuid) to authenticated;
grant execute on function public.admin_feedback_assignees() to authenticated;
