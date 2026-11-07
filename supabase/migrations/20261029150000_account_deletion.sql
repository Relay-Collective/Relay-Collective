-- Permanent account deletion: a platform admin erases one person's account and personal information.
--
-- Until now "Delete account" in the admin console switched the profile off (admin_deactivate_account) and
-- deleted the Supabase login, but kept the person's name, phone, email, driver details and feedback.
-- Deletion is now a tracked job that erases them, in steps that can each be retried:
--
--   storage  the admin-delete-account Edge Function removes the person's own files through the Storage API
--            (feedback screenshots; driver documents once they're uploaded). The step only completes once
--            none of the job's files is left in storage.objects.
--   records  erase_account_records(): one transaction that deletes or anonymizes their rows (below).
--   auth     the Edge Function deletes the Supabase login (hard delete). Completes once auth.users has no row.
--   verify   checks nothing personal is left, removes the placeholder profile if nothing points to it, and
--            closes the job as completed.
--
-- What happens to each kind of data (see docs/ACCOUNT_DELETION.md for the reasoning):
--   deleted     the login; their Feedback & Suggestions submissions with replies, history and screenshots;
--               issues they flagged on rides as a driver; their join requests; invitations sent to their email;
--               driver documents; their rate-limit counters
--   anonymized  the profile keeps its id but not its name, phone or email ("Deleted account"), because rides,
--               ride history, reviews and invitations point at it; it is deleted outright when nothing does.
--               The driver row loses its vehicle, cities and hours the same way. Ride history lines they signed
--               say "Deleted account". Membership events lose the raw login id.
--   kept        rides they booked or drove (the organization's records), staff ratings of rides, replies they
--               wrote as an admin, organization applications (the organization's record), organizations.
--
-- Access
--   * Every function here is for platform admins and checks private.is_admin() itself, as the caller. The
--     Edge Function holds the server-only key for the two steps outside the database (Storage and Auth) only.
--   * The job tables live in the private schema: no API access, no browser writes. Admins read a job through
--     admin_get_account_deletion().
--   * The first step switches the profile off (admin_deactivate_account), so every access check refuses the
--     person straight away, including with a token issued before deletion started.
--   * One open job per profile (unique index); starting is rate limited per admin.
--
-- The job keeps the person's profile id (which is all the placeholder profile keeps either) and, until the
-- login is gone, their login id. It never stores a name or email.

-- ---------------------------------------------------------------------------
-- profiles: the placeholder left behind
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column deleted_at timestamptz,
  add constraint profiles_deleted_is_anonymous
    check (deleted_at is null or (not is_active and name = 'Deleted account' and phone is null and email is null));

grant select (deleted_at) on public.profiles to authenticated;

-- A deleted driver's row stays while finished rides and offers point at it, without their vehicle, cities
-- or hours (seats and wheelchair access say nothing about the person, and stay locked once approved).
-- Only an erased row may be blank. The app leaves erased drivers out of its lists.
alter table public.drivers
  add column deleted_at timestamptz,
  drop constraint drivers_vehicle_not_blank,
  drop constraint drivers_has_city,
  add constraint drivers_vehicle_not_blank check (deleted_at is not null or length(trim(vehicle)) > 0),
  add constraint drivers_has_city check (deleted_at is not null or cardinality(service_cities) > 0),
  add constraint drivers_deleted_is_blank
    check (deleted_at is null or (vehicle = '' and cardinality(service_cities) = 0));

-- ---------------------------------------------------------------------------
-- Jobs and their trail
-- ---------------------------------------------------------------------------

create table private.account_deletion_jobs (
  id                  uuid primary key default gen_random_uuid(),
  -- No foreign keys: the record outlives the profile and the login it describes
  target_profile_id   uuid not null,
  target_auth_user_id uuid,                        -- until the login is deleted; cleared on completion
  target_role         public.user_role not null,
  requested_by        uuid not null,               -- the platform admin's profile id
  status              text not null default 'pending'
                        check (status in ('pending', 'in_progress', 'completed', 'failed', 'requires_attention')),
  current_step        text not null default 'storage'
                        check (current_step in ('storage', 'records', 'auth', 'verify', 'done')),
  plan                jsonb not null default '[]', -- the categories and counts shown to the admin, no personal details
  storage_objects     jsonb not null default '[]', -- [{bucket, path}] the person's files; cleared on completion
  attempts            integer not null default 1,
  error_code          text check (error_code in (
                        'STORAGE_DELETE_FAILED', 'RECORDS_CLEANUP_FAILED', 'AUTH_DELETE_FAILED', 'VERIFICATION_FAILED', 'INTERRUPTED')),
  claimed_at          timestamptz,                 -- a worker is on it; another waits a minute before taking over
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  failed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint account_deletion_jobs_completed check ((status = 'completed') = (completed_at is not null)),
  constraint account_deletion_jobs_done check ((status = 'completed') = (current_step = 'done')),
  constraint account_deletion_jobs_error check ((status in ('failed', 'requires_attention')) = (error_code is not null))
);

-- One open deletion per account, whichever admin starts it
create unique index account_deletion_jobs_one_open on private.account_deletion_jobs (target_profile_id) where status <> 'completed';
create index account_deletion_jobs_created_idx on private.account_deletion_jobs (created_at desc);

create trigger account_deletion_jobs_set_updated_at before update on private.account_deletion_jobs
  for each row execute function public.set_updated_at();

create table private.account_deletion_events (
  id               bigint generated always as identity primary key,
  job_id           uuid not null references private.account_deletion_jobs (id),
  event            text not null check (event in ('requested', 'claimed', 'retried', 'step_completed', 'step_failed', 'completed')),
  step             text,
  error_code       text,
  actor_profile_id uuid,                            -- the platform admin
  created_at       timestamptz not null default clock_timestamp()
);

create index account_deletion_events_job_idx on private.account_deletion_events (job_id, id);

revoke all on private.account_deletion_jobs, private.account_deletion_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.log_deletion_event(p_job_id uuid, p_event text, p_step text default null, p_error_code text default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into private.account_deletion_events (job_id, event, step, error_code, actor_profile_id)
  values (p_job_id, p_event, p_step, p_error_code, private.my_profile_id())
$$;

-- What the admin console sees. p_internal adds what the Edge Function needs to work on it.
create function private.deletion_job_json(p_job private.account_deletion_jobs, p_internal boolean default false)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_job.id,
    'profileId', p_job.target_profile_id,
    'status', p_job.status,
    'step', p_job.current_step,
    'errorCode', p_job.error_code,
    'attempts', p_job.attempts,
    'plan', p_job.plan,
    'startedAt', p_job.started_at,
    'updatedAt', p_job.updated_at,
    'completedAt', p_job.completed_at,
    'failedAt', p_job.failed_at
  ) || case when p_internal then jsonb_build_object(
    'authUserId', p_job.target_auth_user_id,
    -- Only files still there, so a retry asks Storage for what's left
    'storage', coalesce((
      select jsonb_agg(f.item)
      from jsonb_array_elements(p_job.storage_objects) as f(item)
      where exists (select 1 from storage.objects o where o.bucket_id = f.item ->> 'bucket' and o.name = f.item ->> 'path')
    ), '[]'::jsonb)
  ) else '{}'::jsonb end
$$;

-- The person's own files, found through the rows that own them. Never by uploader alone: a document an
-- organization keeps isn't the uploader's to take with them.
create function private.account_deletion_files(p_profile_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'path', o.name) order by o.bucket_id, o.name), '[]'::jsonb)
  from storage.objects o
  where (o.bucket_id = 'feedback-attachments' and o.name in (
          select a.storage_path from public.feedback_attachments a
          join public.feedback_submissions f on f.id = a.feedback_id
          where f.submitted_by = p_profile_id))
     or (o.bucket_id = 'driver-documents' and o.name in (
          select dd.storage_path from public.driver_documents dd
          join public.drivers d on d.id = dd.driver_id
          where d.profile_id = p_profile_id))
$$;

-- What deleting this account would do, from the data as it is now: blockers, and a count and action per
-- category. Keys and codes match src/logic/accountDeletion.ts, which words them for the admin.
create function private.account_deletion_plan(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p public.profiles;
  v_email text;
  v_driver_id uuid;
  v_files jsonb;
  v_blockers text[] := '{}';
  v_categories jsonb;
begin
  select * into v_p from public.profiles where id = p_profile_id;
  if not found then
    return null;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_p.auth_user_id;
  select d.id into v_driver_id from public.drivers d where d.profile_id = v_p.id;
  v_files := private.account_deletion_files(v_p.id);

  if v_p.id = private.my_profile_id() then
    v_blockers := array_append(v_blockers, 'SELF');
  end if;
  if v_p.role = 'PLATFORM_ADMIN' and v_p.is_active
     and not exists (select 1 from public.profiles p where p.role = 'PLATFORM_ADMIN' and p.is_active and p.id <> v_p.id) then
    v_blockers := array_append(v_blockers, 'LAST_PLATFORM_ADMIN');
  end if;
  -- Same rule as the keep_an_org_admin trigger, which lets platform admins through: so it's checked here
  if v_p.role = 'PARTNER' and v_p.org_role = 'ADMIN' and v_p.is_active and v_p.auth_user_id is not null
     and not exists (select 1 from public.profiles p
                     where p.org_id = v_p.org_id and p.id <> v_p.id and p.role = 'PARTNER' and p.org_role = 'ADMIN'
                       and p.is_active and p.auth_user_id is not null)
     and exists (select 1 from public.profiles p
                 where p.org_id = v_p.org_id and p.id <> v_p.id and p.role = 'PARTNER' and p.is_active) then
    v_blockers := array_append(v_blockers, 'LAST_ORG_ADMIN');
  end if;
  -- The last member of a partner organization: nobody would be left to manage its open rides
  if v_p.role = 'PARTNER' and v_p.is_active
     and not exists (select 1 from public.profiles p
                     where p.org_id = v_p.org_id and p.id <> v_p.id and p.role = 'PARTNER' and p.is_active)
     and exists (select 1 from public.rides r
                 where r.org_id = v_p.org_id and r.status in ('SEARCHING', 'OFFERED', 'ACCEPTED', 'NEEDS_ATTENTION', 'PICKED_UP')) then
    v_blockers := array_append(v_blockers, 'ORG_OPEN_RIDES');
  end if;
  if v_p.role = 'ORG_ADMIN' and v_p.is_active
     and not exists (select 1 from public.profiles p where p.org_id = v_p.org_id and p.id <> v_p.id and p.role = 'ORG_ADMIN' and p.is_active)
     and exists (select 1 from public.drivers d join public.profiles dp on dp.id = d.profile_id
                 where d.org_id = v_p.org_id and dp.is_active) then
    v_blockers := array_append(v_blockers, 'LAST_PROVIDER_ADMIN');
  end if;
  if v_driver_id is not null and exists (select 1 from public.rides r where r.driver_id = v_driver_id and r.status = 'PICKED_UP') then
    v_blockers := array_append(v_blockers, 'DRIVER_ON_TRIP');
  end if;
  -- The admin confirms by typing it, so an account without one can't be confirmed
  if v_email is null then
    v_blockers := array_append(v_blockers, 'NO_SIGN_IN_EMAIL');
  end if;

  select jsonb_agg(jsonb_build_object('key', c.key, 'action', c.action, 'count', c.n) order by c.ord)
  into v_categories
  from (values
    (1, 'auth_account', 'delete', (v_p.auth_user_id is not null)::int),
    (2, 'profile', 'anonymize', 1),
    (3, 'organization_membership', 'remove',
       (v_p.role in ('PARTNER', 'ORG_ADMIN') and v_p.org_id is not null and v_p.removed_at is null)::int),
    (4, 'driver_profile', 'delete', (v_driver_id is not null)::int),
    (5, 'driver_documents', 'delete', (select count(*)::int from public.driver_documents dd where dd.driver_id = v_driver_id)),
    (6, 'open_rides', 'reassign', (
       select count(*)::int from public.rides r
       where r.status in ('SEARCHING', 'OFFERED', 'ACCEPTED', 'NEEDS_ATTENTION')
         and (r.driver_id = v_driver_id
              or exists (select 1 from public.ride_offers o where o.ride_id = r.id and o.driver_id = v_driver_id and o.status = 'PENDING')))),
    (7, 'product_feedback', 'delete', (select count(*)::int from public.feedback_submissions f where f.submitted_by = v_p.id)),
    (8, 'personal_files', 'delete', jsonb_array_length(v_files)),
    (9, 'feedback_assignments', 'detach', (select count(*)::int from public.feedback_submissions f where f.assigned_to = v_p.id)),
    (10, 'feedback_replies', 'retain', (
       select count(*)::int from public.feedback_messages m
       join public.feedback_submissions f on f.id = m.feedback_id
       where m.author_id = v_p.id and f.submitted_by <> v_p.id)),
    (11, 'join_requests', 'delete', (select count(*)::int from public.organization_join_requests r where r.user_id = v_p.auth_user_id)),
    (12, 'invitations', 'delete', (
       select count(*)::int from public.organization_invitations i where i.email = v_email or i.accepted_by = v_p.id)),
    (13, 'ride_issue_reports', 'delete', (
       select count(*)::int from public.ride_feedback rf where rf.author_profile_id = v_p.id and rf.author_role = 'DRIVER')),
    (14, 'rides_requested', 'retain', (select count(*)::int from public.rides r where r.requested_by = v_p.id)),
    (15, 'rides_driven', 'retain', (
       select count(*)::int from public.rides r where r.driver_id = v_driver_id and r.status in ('PICKED_UP', 'COMPLETED', 'NO_SHOW'))),
    (16, 'ride_ratings', 'retain', (
       select count(*)::int from public.ride_feedback rf where rf.author_profile_id = v_p.id and rf.author_role = 'PARTNER')),
    (17, 'ride_history', 'anonymize', (select count(*)::int from public.ride_events e where e.actor_profile_id = v_p.id)),
    (18, 'organization_applications', 'retain', (
       select count(*)::int from public.organization_applications a where a.submitted_by = v_p.id)),
    (19, 'preferences', 'none', 0),
    (20, 'deletion_record', 'retain', 1)
  ) as c(ord, key, action, n);

  return jsonb_build_object('blockers', to_jsonb(v_blockers), 'categories', v_categories, 'files', v_files);
end;
$$;

-- Deletes or anonymizes everything in the database that is about this person. One transaction: it all
-- happens or none of it does. Files must already be gone (their rows are deleted here).
create function private.erase_account_records(p_profile_id uuid, p_auth_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_driver_id uuid;
  v_email text;
begin
  select d.id into v_driver_id from public.drivers d where d.profile_id = p_profile_id;
  select lower(u.email) into v_email from auth.users u where u.id = p_auth_user_id;

  -- Feedback & Suggestions they sent: free text about them, in their words. Deleted with everything on it.
  delete from public.feedback_messages m using public.feedback_submissions f
   where m.feedback_id = f.id and f.submitted_by = p_profile_id;
  delete from public.feedback_status_history h using public.feedback_submissions f
   where h.feedback_id = f.id and f.submitted_by = p_profile_id;
  delete from public.feedback_attachments a using public.feedback_submissions f
   where a.feedback_id = f.id and f.submitted_by = p_profile_id;
  delete from public.feedback_submissions where submitted_by = p_profile_id;
  update public.feedback_submissions set assigned_to = null where assigned_to = p_profile_id;

  -- Issues they flagged on rides as a driver. Staff ratings of a ride are the organization's and stay.
  delete from public.ride_feedback where author_profile_id = p_profile_id and author_role = 'DRIVER';

  -- History lines they signed still say what happened, not who
  update public.ride_events set actor_name = 'Deleted account' where actor_profile_id = p_profile_id;

  if p_auth_user_id is not null then
    delete from public.organization_join_requests where user_id = p_auth_user_id;
    update public.organization_membership_events set subject_user_id = null where subject_user_id = p_auth_user_id;
    update public.organization_membership_events set actor_user_id = null where actor_user_id = p_auth_user_id;
    delete from private.rate_limits where bucket like '%:' || p_auth_user_id::text;
  end if;
  delete from public.organization_invitations where accepted_by = p_profile_id or (v_email is not null and email = v_email);

  if v_driver_id is not null then
    delete from public.driver_documents where driver_id = v_driver_id;
    -- Rides not finished yet stop waiting for them. Finished rides keep pointing at the anonymous driver.
    update public.rides set preferred_driver_id = null
     where preferred_driver_id = v_driver_id and status not in ('COMPLETED', 'NO_SHOW', 'CANCELLED');
    update public.rides set reconfirm_driver_id = null
     where reconfirm_driver_id = v_driver_id and status not in ('COMPLETED', 'NO_SHOW', 'CANCELLED');
    update public.drivers
       set vehicle = '', service_cities = '{}',
           request_hours = '[null, null, null, null, null, null, null]'::jsonb, deleted_at = coalesce(deleted_at, now())
     where id = v_driver_id;
  end if;

  -- The login link stays until the login is deleted (auth_user_id is ON DELETE SET NULL), so in between the
  -- identity reads as a closed account rather than a new one that could sign up again
  update public.profiles
     set name = 'Deleted account', phone = null, email = null, is_active = false, deleted_at = coalesce(deleted_at, now())
   where id = p_profile_id;
end;
$$;

-- What is still there that shouldn't be. Empty means the deletion is complete.
create function private.account_deletion_leftovers(p_job private.account_deletion_jobs)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select array_remove(array[
    case when p_job.target_auth_user_id is not null
              and exists (select 1 from auth.users u where u.id = p_job.target_auth_user_id) then 'auth_account' end,
    case when exists (select 1 from public.profiles p
                      where p.id = p_job.target_profile_id
                        and (p.deleted_at is null or p.is_active or p.phone is not null or p.email is not null
                             or p.name <> 'Deleted account')) then 'profile' end,
    case when exists (select 1 from public.drivers d
                      where d.profile_id = p_job.target_profile_id and d.deleted_at is null) then 'driver_profile' end,
    case when exists (select 1 from public.driver_documents dd join public.drivers d on d.id = dd.driver_id
                      where d.profile_id = p_job.target_profile_id) then 'driver_documents' end,
    case when exists (select 1 from public.feedback_submissions f where f.submitted_by = p_job.target_profile_id) then 'product_feedback' end,
    case when exists (select 1 from jsonb_array_elements(p_job.storage_objects) as f(item)
                      join storage.objects o on o.bucket_id = f.item ->> 'bucket' and o.name = f.item ->> 'path') then 'personal_files' end,
    case when exists (select 1 from public.organization_join_requests r where r.user_id = p_job.target_auth_user_id) then 'join_requests' end,
    case when exists (select 1 from public.ride_feedback rf
                      where rf.author_profile_id = p_job.target_profile_id and rf.author_role = 'DRIVER') then 'ride_issue_reports' end
  ], null)
$$;

-- ---------------------------------------------------------------------------
-- The admin console's view
-- ---------------------------------------------------------------------------

-- What deleting this account would do, worked out from the data now. state: READY, BLOCKED, IN_PROGRESS
-- (a job is open: see job) or DELETED. Never changes anything.
create function public.admin_account_deletion_preview(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p public.profiles;
  v_plan jsonb;
  v_job private.account_deletion_jobs;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  select * into v_p from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Account not found. It may already have been deleted.' using errcode = 'P0001';
  end if;

  select * into v_job from private.account_deletion_jobs j
   where j.target_profile_id = p_profile_id order by (j.status <> 'completed') desc, j.created_at desc limit 1;
  if v_job.id is not null and v_job.status <> 'completed' then
    return jsonb_build_object('state', 'IN_PROGRESS', 'profileId', v_p.id, 'role', v_p.role,
                              'job', private.deletion_job_json(v_job), 'blockers', '[]'::jsonb, 'categories', v_job.plan);
  end if;
  if v_p.deleted_at is not null then
    return jsonb_build_object('state', 'DELETED', 'profileId', v_p.id, 'role', v_p.role,
                              'job', case when v_job.id is not null then private.deletion_job_json(v_job) end,
                              'blockers', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;

  v_plan := private.account_deletion_plan(p_profile_id);
  return jsonb_build_object(
    'state', case when jsonb_array_length(v_plan -> 'blockers') > 0 then 'BLOCKED' else 'READY' end,
    'profileId', v_p.id,
    'name', v_p.name,
    'email', (select u.email from auth.users u where u.id = v_p.auth_user_id),
    'role', v_p.role,
    'orgName', (select o.name from public.organizations o where o.id = v_p.org_id),
    'blockers', v_plan -> 'blockers',
    'categories', v_plan -> 'categories'
  );
end;
$$;

create function public.admin_get_account_deletion(p_job_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_job private.account_deletion_jobs;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  select * into v_job from private.account_deletion_jobs where id = p_job_id;
  return case when v_job.id is not null then private.deletion_job_json(v_job) end; -- null: not found
end;
$$;

-- ---------------------------------------------------------------------------
-- The workflow. Called by the admin-delete-account Edge Function as the admin, after it has checked their
-- password again. Each call re-checks that the caller is still an active platform admin.
-- ---------------------------------------------------------------------------

-- Starts deleting an account. p_confirm_email is what the admin typed; the account itself is p_profile_id.
-- Switches the account off and moves a driver's open work to other drivers (admin_deactivate_account) in
-- the same transaction that creates the job.
create function public.admin_begin_account_deletion(p_profile_id uuid, p_confirm_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.profiles;
  v_email text;
  v_plan jsonb;
  v_blocker text;
  v_job private.account_deletion_jobs;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  perform private.take_rate_limit('account-deletion:' || auth.uid()::text, 10, interval '1 hour',
                                  'You''ve started several account deletions in the last hour. Please wait before starting another.');

  -- Two admins starting at once queue on this lock; the second finds the first one's job
  select * into v_p from public.profiles where id = p_profile_id for update;
  if not found or v_p.deleted_at is not null then
    raise exception 'Account not found. It may already have been deleted.' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.account_deletion_jobs j where j.target_profile_id = p_profile_id and j.status <> 'completed') then
    raise exception 'This account is already being deleted. Refresh to see how it''s going.' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_p.auth_user_id;
  if v_email is null or v_email <> lower(btrim(coalesce(p_confirm_email, ''))) then
    raise exception 'The email you typed doesn''t match this account.' using errcode = 'P0001';
  end if;

  v_plan := private.account_deletion_plan(p_profile_id);
  v_blocker := v_plan -> 'blockers' ->> 0;
  if v_blocker is not null then
    raise exception '%', case v_blocker
      when 'SELF' then 'You can''t delete the account you''re signed in with.'
      when 'LAST_PLATFORM_ADMIN' then 'This is the only Relay Collective admin account, so it can''t be deleted.'
      when 'LAST_ORG_ADMIN' then 'This person is their organization''s only administrator. Make another member an administrator first.'
      when 'ORG_OPEN_RIDES' then 'This is the last member of their organization, and it still has open rides. Cancel them first.'
      when 'LAST_PROVIDER_ADMIN' then 'This person is the only administrator of a transport provider with active drivers.'
      when 'DRIVER_ON_TRIP' then 'This driver has a client in the car right now. Try again once the ride is finished.'
      else 'This account can''t be deleted right now.'
    end using errcode = 'P0001';
  end if;

  -- Access ends here, before anything is erased
  perform public.admin_deactivate_account(p_profile_id);

  insert into private.account_deletion_jobs (target_profile_id, target_auth_user_id, target_role, requested_by, plan, storage_objects)
  values (v_p.id, v_p.auth_user_id, v_p.role, private.my_profile_id(), v_plan -> 'categories', v_plan -> 'files')
  returning * into v_job;
  perform private.log_deletion_event(v_job.id, 'requested');
  return private.deletion_job_json(v_job, true);
end;
$$;

-- Takes up a job to work on it: a new one, or a retry of one that failed or was interrupted. Another worker
-- can take over a job nobody has touched for a minute.
create function public.admin_claim_account_deletion(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_job private.account_deletion_jobs;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  select * into v_job from private.account_deletion_jobs where id = p_job_id for update;
  if not found then
    raise exception 'That deletion wasn''t found.' using errcode = 'P0001';
  end if;
  if v_job.status = 'completed' then
    return private.deletion_job_json(v_job, true);
  end if;
  if v_job.status = 'in_progress' and v_job.updated_at > now() - interval '1 minute' then
    raise exception 'This deletion is running right now. Wait a moment, then check how it''s going.' using errcode = 'P0001';
  end if;

  update private.account_deletion_jobs
     set status = 'in_progress', error_code = null, failed_at = null, claimed_at = now(),
         attempts = attempts + case when status = 'pending' then 0 else 1 end
   where id = p_job_id
  returning * into v_job;
  perform private.log_deletion_event(p_job_id, case when v_job.attempts > 1 then 'retried' else 'claimed' end, v_job.current_step);
  return private.deletion_job_json(v_job, true);
end;
$$;

-- Finishes p_step and moves to the next one, after checking the step really is done. A step that isn't
-- current (another worker finished it) returns the job as it is.
create function public.admin_advance_account_deletion(p_job_id uuid, p_step text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_job private.account_deletion_jobs;
  v_next text;
  v_error text;
  v_status text := 'failed';
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  select * into v_job from private.account_deletion_jobs where id = p_job_id for update;
  if not found then
    raise exception 'That deletion wasn''t found.' using errcode = 'P0001';
  end if;
  if v_job.status <> 'in_progress' or v_job.current_step <> p_step then
    return private.deletion_job_json(v_job, true);
  end if;

  if p_step = 'storage' then
    if 'personal_files' = any (private.account_deletion_leftovers(v_job)) then
      v_error := 'STORAGE_DELETE_FAILED';
    else
      v_next := 'records';
    end if;
  elsif p_step = 'records' then
    begin
      perform private.erase_account_records(v_job.target_profile_id, v_job.target_auth_user_id);
      v_next := 'auth';
    exception when others then
      -- Rolled back to before the erase. The detail goes to the database log, never to the screen.
      raise warning 'account deletion % records step failed: %', p_job_id, sqlstate;
      v_error := 'RECORDS_CLEANUP_FAILED';
      v_status := 'requires_attention';
    end;
  elsif p_step = 'auth' then
    if 'auth_account' = any (private.account_deletion_leftovers(v_job)) then
      v_error := 'AUTH_DELETE_FAILED';
    else
      v_next := 'verify';
    end if;
  elsif p_step = 'verify' then
    if cardinality(private.account_deletion_leftovers(v_job)) > 0 then
      v_error := 'VERIFICATION_FAILED';
      v_status := 'requires_attention';
    else
      -- Nothing personal is left. The anonymous rows go too when nothing points at them any more.
      begin
        delete from public.drivers where profile_id = v_job.target_profile_id;
      exception when foreign_key_violation then null;
      end;
      begin
        delete from public.profiles where id = v_job.target_profile_id;
      exception when foreign_key_violation then null;
      end;
      v_next := 'done';
    end if;
  else
    raise exception 'Unknown deletion step.' using errcode = 'P0001';
  end if;

  if v_error is not null then
    update private.account_deletion_jobs
       set status = v_status, error_code = v_error, failed_at = now(), claimed_at = null
     where id = p_job_id
    returning * into v_job;
    perform private.log_deletion_event(p_job_id, 'step_failed', p_step, v_error);
  elsif v_next = 'done' then
    update private.account_deletion_jobs
       set status = 'completed', current_step = 'done', completed_at = now(), claimed_at = null,
           target_auth_user_id = null, storage_objects = '[]'::jsonb
     where id = p_job_id
    returning * into v_job;
    perform private.log_deletion_event(p_job_id, 'step_completed', p_step);
    perform private.log_deletion_event(p_job_id, 'completed');
  else
    update private.account_deletion_jobs set current_step = v_next where id = p_job_id returning * into v_job;
    perform private.log_deletion_event(p_job_id, 'step_completed', p_step);
  end if;
  return private.deletion_job_json(v_job, true);
end;
$$;

-- The Edge Function reports a step it couldn't do outside the database (Storage or Auth refused, or it
-- was cut short). The job waits for a retry.
create function public.admin_fail_account_deletion(p_job_id uuid, p_step text, p_error_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_job private.account_deletion_jobs;
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can delete accounts.' using errcode = 'P0001';
  end if;
  if p_error_code is null or p_error_code not in ('STORAGE_DELETE_FAILED', 'AUTH_DELETE_FAILED', 'INTERRUPTED') then
    raise exception 'Unknown deletion error.' using errcode = 'P0001';
  end if;
  update private.account_deletion_jobs
     set status = 'failed', error_code = p_error_code, failed_at = now(), claimed_at = null
   where id = p_job_id and status = 'in_progress' and current_step = p_step
  returning * into v_job;
  if v_job.id is null then
    select * into v_job from private.account_deletion_jobs where id = p_job_id;
  else
    perform private.log_deletion_event(p_job_id, 'step_failed', p_step, p_error_code);
  end if;
  return private.deletion_job_json(v_job, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The admin account list says which accounts are being deleted (their login still exists until the end)
-- ---------------------------------------------------------------------------

drop function public.admin_list_accounts();
create function public.admin_list_accounts()
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  role public.user_role,
  org_id uuid,
  house_id uuid,
  org_role text,
  deletion_status text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Relay Collective admins can list accounts.' using errcode = 'P0001';
  end if;
  return query
    select p.id, p.name, p.phone, u.email::text, p.role, p.org_id, p.house_id, p.org_role,
           (select j.status from private.account_deletion_jobs j where j.target_profile_id = p.id and j.status <> 'completed')
    from public.profiles p
    join auth.users u on u.id = p.auth_user_id
    order by p.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions: signed-in users only (each function checks for a platform admin). Helpers are internal.
-- ---------------------------------------------------------------------------

revoke execute on function private.log_deletion_event(uuid, text, text, text) from public;
revoke execute on function private.deletion_job_json(private.account_deletion_jobs, boolean) from public;
revoke execute on function private.account_deletion_files(uuid) from public;
revoke execute on function private.account_deletion_plan(uuid) from public;
revoke execute on function private.erase_account_records(uuid, uuid) from public;
revoke execute on function private.account_deletion_leftovers(private.account_deletion_jobs) from public;

revoke execute on function public.admin_account_deletion_preview(uuid) from public, anon;
revoke execute on function public.admin_get_account_deletion(uuid) from public, anon;
revoke execute on function public.admin_begin_account_deletion(uuid, text) from public, anon;
revoke execute on function public.admin_claim_account_deletion(uuid) from public, anon;
revoke execute on function public.admin_advance_account_deletion(uuid, text) from public, anon;
revoke execute on function public.admin_fail_account_deletion(uuid, text, text) from public, anon;
revoke execute on function public.admin_list_accounts() from public, anon;

grant execute on function public.admin_account_deletion_preview(uuid) to authenticated;
grant execute on function public.admin_get_account_deletion(uuid) to authenticated;
grant execute on function public.admin_begin_account_deletion(uuid, text) to authenticated;
grant execute on function public.admin_claim_account_deletion(uuid) to authenticated;
grant execute on function public.admin_advance_account_deletion(uuid, text) to authenticated;
grant execute on function public.admin_fail_account_deletion(uuid, text, text) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
