-- General volunteers: volunteering becomes a platform-level identity, separate from CareRide driving.
-- Needs 20261104120000_volunteer_role.sql (the VOLUNTEER enum value) applied first.
--
-- Three separate concepts (docs/architecture/volunteers.md):
--
--   volunteer identity   profiles.role = 'VOLUNTEER'   someone who volunteers and has no other role. Like every
--                                                      role, set only by a database function, never by the browser.
--   volunteer profile    volunteer_profiles            platform-level participation: one per profile, at most.
--     + interests        volunteer_interests           what kinds of help they'd like to give. DESCRIPTIVE ONLY.
--   CareRide driver      drivers (+ role DRIVER)       unchanged. Vehicle, cities, hours and verification status.
--
-- Security rules this migration keeps:
--   * Interests never grant anything. No policy, function or check anywhere reads volunteer_interests to
--     decide access. Selecting TRANSPORTATION doesn't create a drivers row, and only an APPROVED drivers row
--     (via private.my_driver_id() and the ride functions) lets anyone see or take rides.
--   * A VOLUNTEER profile has no organization (constraint below), so the org-scoped policies never match it,
--     and private.my_driver_id() is null for it, so every CareRide policy and ride function refuses it.
--   * The browser can only read its own volunteer rows. Every write goes through the two functions below,
--     which take the profile from auth.uid(), never from an argument.
--
-- Also here, so a VOLUNTEER account behaves like the other self-registered accounts:
--   * deactivate_my_account() lets a volunteer close their own sign-in.
--   * Feedback & Suggestions files a volunteer's feedback under the volunteer workspace.
--   * Permanent account deletion (admins) lists, erases and verifies the volunteer profile and interests.

-- ---------------------------------------------------------------------------
-- profiles: a general volunteer doesn't belong to an organization
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_volunteer_no_org check (role <> 'VOLUNTEER' or (org_id is null and house_id is null));

-- ---------------------------------------------------------------------------
-- volunteer_profiles: platform-level volunteering, attached to an existing profile.
-- Name, phone and email stay on profiles: nothing about the person is copied here.
-- Any role may hold one (a DRIVER who also volunteers keeps role DRIVER); unique, so never two.
-- ---------------------------------------------------------------------------

create table public.volunteer_profiles (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger volunteer_profiles_set_updated_at before update on public.volunteer_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- volunteer_interests: one row per interest a volunteer chose. The primary key keeps each one once.
-- The codes match VOLUNTEER_INTERESTS in src/volunteer/interests.ts. Adding one takes a migration
-- (this check and private.volunteer_interests_from()) and an entry there.
-- ---------------------------------------------------------------------------

create table public.volunteer_interests (
  volunteer_profile_id uuid not null references public.volunteer_profiles (id) on delete cascade,
  interest             text not null
                         check (interest in ('TRANSPORTATION', 'FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION', 'GENERAL')),
  created_at           timestamptz not null default now(),
  primary key (volunteer_profile_id, interest)
);

-- ---------------------------------------------------------------------------
-- Access: read your own (platform admins read all). No direct writes at all.
-- New tables get every privilege by default on Supabase, so take them all back first.
-- ---------------------------------------------------------------------------

alter table public.volunteer_profiles  enable row level security;
alter table public.volunteer_interests enable row level security;

revoke all on public.volunteer_profiles, public.volunteer_interests from anon, authenticated;
grant select on public.volunteer_profiles, public.volunteer_interests to authenticated;

-- The signed-in, active account's volunteer profile, or null
create function private.my_volunteer_profile_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select vp.id from public.volunteer_profiles vp where vp.profile_id = private.my_profile_id()
$$;

create policy volunteer_profiles_select on public.volunteer_profiles
  for select to authenticated
  using (
    (select private.is_admin())
    or profile_id = (select private.my_profile_id())
  );

create policy volunteer_interests_select on public.volunteer_interests
  for select to authenticated
  using (
    (select private.is_admin())
    or volunteer_profile_id = (select private.my_volunteer_profile_id())
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- A JSON array of interest codes, checked: at least one, each a known code, each once.
-- Unknown values are refused rather than dropped, so a typo can't quietly lose someone's choice.
create function private.volunteer_interests_from(p_interests jsonb)
returns text[]
language plpgsql immutable set search_path = ''
as $$
declare
  v_interests text[];
begin
  if jsonb_typeof(p_interests) is distinct from 'array' or jsonb_array_length(p_interests) = 0 then
    raise exception 'Choose at least one way you''d like to help.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_interests) as i(value)
             where jsonb_typeof(i.value) <> 'string'
                or i.value #>> '{}' not in ('TRANSPORTATION', 'FOOD_DISTRIBUTION', 'COMMUNITY_OUTREACH', 'RESOURCE_COORDINATION', 'GENERAL')) then
    raise exception 'One of those volunteering interests isn''t one we offer. Please choose again.' using errcode = 'P0001';
  end if;
  select array_agg(distinct i order by i) into v_interests from jsonb_array_elements_text(p_interests) as i;
  return v_interests;
end;
$$;

-- register_volunteer(): the caller joins Relay Collective as a volunteer. Returns their profile id.
--   * A new identity gets a VOLUNTEER profile (name, optional phone), a volunteer profile and its interests.
--   * An existing DRIVER keeps their role and driver profile, and gains a volunteer profile (not exposed in
--     the app yet; see the docs). Their interests never change anything about driving.
--   * Already a volunteer: returns the same profile (a retry, a second tab). The interests saved first stand.
--   * Any other role (organization staff, admins) is refused: one profile per login.
-- Never creates a drivers row, whatever the interests say.
create function public.register_volunteer(p_details jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_profile_id uuid;
  v_volunteer_id uuid;
  v_interests text[];
  v_phone text;
  v_has_profile boolean;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  -- Same lock as the other onboarding paths, so no two can race for one login
  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  select * into v_profile from public.profiles p where p.auth_user_id = v_uid;
  v_has_profile := found;
  if v_has_profile and v_profile.is_active and v_profile.role = 'VOLUNTEER' then
    return v_profile.id;
  end if;
  if v_has_profile and not (v_profile.is_active and v_profile.role = 'DRIVER') then
    raise exception 'This account already has a Relay Collective role, so it can''t also register as a volunteer.'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'Fill in your volunteer details.' using errcode = 'P0001';
  end if;
  v_interests := private.volunteer_interests_from(p_details -> 'interests');

  if v_has_profile then
    -- A driver who also volunteers. Already registered: the earlier choice stands.
    v_profile_id := v_profile.id;
    if exists (select 1 from public.volunteer_profiles vp where vp.profile_id = v_profile_id) then
      return v_profile_id;
    end if;
  else
    v_phone := nullif(trim(coalesce(p_details ->> 'phone', '')), '');
    if v_phone is not null then
      v_phone := private.valid_phone(v_phone, 'Phone');
    end if;
    insert into public.profiles (auth_user_id, name, phone, email, role)
    values (
      v_uid,
      private.required_text(p_details ->> 'name', 'Your name'),
      v_phone,
      (select u.email from auth.users u where u.id = v_uid),
      'VOLUNTEER'
    )
    returning id into v_profile_id;
  end if;

  insert into public.volunteer_profiles (profile_id) values (v_profile_id) returning id into v_volunteer_id;
  insert into public.volunteer_interests (volunteer_profile_id, interest)
  select v_volunteer_id, i from unnest(v_interests) as i;

  return v_profile_id;
end;
$$;

-- set_my_volunteer_interests(): replaces the caller's interests with these. Only their own: the volunteer
-- profile comes from the session. Touches nothing else (no role, no driver row, no verification).
create function public.set_my_volunteer_interests(p_interests jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_volunteer_id uuid := private.my_volunteer_profile_id();
  v_interests text[];
begin
  if v_volunteer_id is null then
    raise exception 'Register as a volunteer first.' using errcode = 'P0001';
  end if;
  v_interests := private.volunteer_interests_from(p_interests);

  -- One change at a time per volunteer (two tabs saving at once end with one or the other, never a mix)
  perform 1 from public.volunteer_profiles vp where vp.id = v_volunteer_id for update;

  delete from public.volunteer_interests vi
   where vi.volunteer_profile_id = v_volunteer_id and vi.interest <> all (v_interests);
  insert into public.volunteer_interests (volunteer_profile_id, interest)
  select v_volunteer_id, i from unnest(v_interests) as i
  on conflict do nothing;

  update public.volunteer_profiles set updated_at = now() where id = v_volunteer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feedback & Suggestions: submit_feedback() files anyone who isn't an admin or a driver under
-- 'organization'. A volunteer's feedback belongs under 'volunteer' (the workspace they use).
-- ---------------------------------------------------------------------------

create function private.feedback_volunteer_workspace()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select p.role from public.profiles p where p.id = new.submitted_by) = 'VOLUNTEER' then
    new.source_workspace := 'volunteer';
  end if;
  return new;
end;
$$;

create trigger feedback_submissions_volunteer_workspace before insert on public.feedback_submissions
  for each row execute function private.feedback_volunteer_workspace();

-- ---------------------------------------------------------------------------
-- deactivate_my_account(): a volunteer may close their own sign-in.
-- (Otherwise unchanged from the identity-onboarding migration.)
-- ---------------------------------------------------------------------------

create or replace function public.deactivate_my_account()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_driver_id uuid;
  v_ride public.rides;
begin
  if v_uid is null then
    raise exception 'Please sign in.' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where auth_user_id = v_uid for update;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0001';
  end if;
  if v_profile.role not in ('DRIVER', 'PARTNER', 'VOLUNTEER') then
    raise exception 'This account can''t be closed from here.' using errcode = 'P0001';
  end if;
  if not v_profile.is_active then
    return v_profile.auth_user_id;
  end if;

  -- A general volunteer has no rides, offers or organization to hand over: only their sign-in closes.
  -- Their volunteer profile stays with the closed account (like a driver's row) until an admin deletes it.
  if v_profile.role = 'VOLUNTEER' then
    update public.profiles set is_active = false where id = v_profile.id;
    return v_profile.auth_user_id;
  end if;

  if v_profile.role = 'DRIVER' then
    select d.id into v_driver_id from public.drivers d where d.profile_id = v_profile.id;

    if v_driver_id is not null then
      perform 1 from public.rides r
       where (r.driver_id = v_driver_id and r.status in ('ACCEPTED', 'PICKED_UP'))
          or exists (select 1 from public.ride_offers o
                     where o.ride_id = r.id and o.driver_id = v_driver_id and o.status = 'PENDING')
       order by r.id
       for update of r;

      if exists (select 1 from public.rides r where r.driver_id = v_driver_id and r.status = 'PICKED_UP') then
        raise exception 'You have a client in the car right now. Finish that ride, then close your account.'
          using errcode = 'P0001';
      end if;
    end if;

    update public.profiles set is_active = false where id = v_profile.id;

    if v_driver_id is not null then
      for v_ride in
        select r.* from public.rides r
        where exists (select 1 from public.ride_offers o
                      where o.ride_id = r.id and o.driver_id = v_driver_id and o.status = 'PENDING')
        order by r.id
      loop
        update public.ride_offers set status = 'EXPIRED'
         where ride_id = v_ride.id and driver_id = v_driver_id and status = 'PENDING';
        perform private.dispatch_if_unanswered(v_ride.id);
      end loop;

      for v_ride in
        select r.* from public.rides r
        where r.driver_id = v_driver_id and r.status = 'ACCEPTED'
        order by r.id
      loop
        update public.rides set
          status = 'SEARCHING',
          driver_id = null, accepted_at = null, driver_on_the_way_at = null, driver_eta = null, driver_arrived_at = null
        where id = v_ride.id;
        perform private.dispatch(v_ride.id);
      end loop;
    end if;
  elsif exists (select 1 from public.profiles p
                where p.org_id = v_profile.org_id and p.id <> v_profile.id and p.is_active
                  and p.role in ('PARTNER', 'ORG_ADMIN')) then
    -- Colleagues are still here to manage the organization's rides.
    update public.profiles set is_active = false where id = v_profile.id;
  else
    perform 1 from public.rides r
     where r.org_id = v_profile.org_id
       and (
         r.status in ('SEARCHING', 'OFFERED', 'NEEDS_ATTENTION')
         or (r.status = 'ACCEPTED' and r.driver_on_the_way_at is null and r.driver_arrived_at is null)
       )
     order by r.id
     for update of r;

    update public.profiles set is_active = false where id = v_profile.id;

    for v_ride in
      select r.* from public.rides r
      where r.org_id = v_profile.org_id
        and (
          r.status in ('SEARCHING', 'OFFERED', 'NEEDS_ATTENTION')
          or (r.status = 'ACCEPTED' and r.driver_on_the_way_at is null and r.driver_arrived_at is null)
        )
      order by r.id
    loop
      update public.rides
         set status = 'CANCELLED',
             cancel_reason = 'The organization closed its CareRide account.',
             cancelled_at = now()
       where id = v_ride.id;
      perform private.close_pending_offers(v_ride.id);
    end loop;
  end if;

  return v_profile.auth_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permanent account deletion: the volunteer profile and interests are personal, so they're listed in the
-- plan, erased with the other records, and checked for in verification. (Otherwise unchanged from
-- 20261029150000_account_deletion.sql.) The foreign keys cascade too, for when the placeholder profile goes.
-- ---------------------------------------------------------------------------

create or replace function private.account_deletion_plan(p_profile_id uuid)
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
    (3, 'volunteer_profile', 'delete', (select count(*)::int from public.volunteer_profiles vp where vp.profile_id = v_p.id)),
    (4, 'organization_membership', 'remove',
       (v_p.role in ('PARTNER', 'ORG_ADMIN') and v_p.org_id is not null and v_p.removed_at is null)::int),
    (5, 'driver_profile', 'delete', (v_driver_id is not null)::int),
    (6, 'driver_documents', 'delete', (select count(*)::int from public.driver_documents dd where dd.driver_id = v_driver_id)),
    (7, 'open_rides', 'reassign', (
       select count(*)::int from public.rides r
       where r.status in ('SEARCHING', 'OFFERED', 'ACCEPTED', 'NEEDS_ATTENTION')
         and (r.driver_id = v_driver_id
              or exists (select 1 from public.ride_offers o where o.ride_id = r.id and o.driver_id = v_driver_id and o.status = 'PENDING')))),
    (8, 'product_feedback', 'delete', (select count(*)::int from public.feedback_submissions f where f.submitted_by = v_p.id)),
    (9, 'personal_files', 'delete', jsonb_array_length(v_files)),
    (10, 'feedback_assignments', 'detach', (select count(*)::int from public.feedback_submissions f where f.assigned_to = v_p.id)),
    (11, 'feedback_replies', 'retain', (
       select count(*)::int from public.feedback_messages m
       join public.feedback_submissions f on f.id = m.feedback_id
       where m.author_id = v_p.id and f.submitted_by <> v_p.id)),
    (12, 'join_requests', 'delete', (select count(*)::int from public.organization_join_requests r where r.user_id = v_p.auth_user_id)),
    (13, 'invitations', 'delete', (
       select count(*)::int from public.organization_invitations i where i.email = v_email or i.accepted_by = v_p.id)),
    (14, 'ride_issue_reports', 'delete', (
       select count(*)::int from public.ride_feedback rf where rf.author_profile_id = v_p.id and rf.author_role = 'DRIVER')),
    (15, 'rides_requested', 'retain', (select count(*)::int from public.rides r where r.requested_by = v_p.id)),
    (16, 'rides_driven', 'retain', (
       select count(*)::int from public.rides r where r.driver_id = v_driver_id and r.status in ('PICKED_UP', 'COMPLETED', 'NO_SHOW'))),
    (17, 'ride_ratings', 'retain', (
       select count(*)::int from public.ride_feedback rf where rf.author_profile_id = v_p.id and rf.author_role = 'PARTNER')),
    (18, 'ride_history', 'anonymize', (select count(*)::int from public.ride_events e where e.actor_profile_id = v_p.id)),
    (19, 'organization_applications', 'retain', (
       select count(*)::int from public.organization_applications a where a.submitted_by = v_p.id)),
    (20, 'preferences', 'none', 0),
    (21, 'deletion_record', 'retain', 1)
  ) as c(ord, key, action, n);

  return jsonb_build_object('blockers', to_jsonb(v_blockers), 'categories', v_categories, 'files', v_files);
end;
$$;

create or replace function private.erase_account_records(p_profile_id uuid, p_auth_user_id uuid)
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

  -- Their volunteer profile and the interests they chose (interests go with it: on delete cascade)
  delete from public.volunteer_profiles where profile_id = p_profile_id;

  -- The login link stays until the login is deleted (auth_user_id is ON DELETE SET NULL), so in between the
  -- identity reads as a closed account rather than a new one that could sign up again
  update public.profiles
     set name = 'Deleted account', phone = null, email = null, is_active = false, deleted_at = coalesce(deleted_at, now())
   where id = p_profile_id;
end;
$$;

create or replace function private.account_deletion_leftovers(p_job private.account_deletion_jobs)
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
                      where rf.author_profile_id = p_job.target_profile_id and rf.author_role = 'DRIVER') then 'ride_issue_reports' end,
    case when exists (select 1 from public.volunteer_profiles vp
                      where vp.profile_id = p_job.target_profile_id) then 'volunteer_profile' end
  ], null)
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions: signed-in users only. Internal helpers are not callable from the API.
-- ---------------------------------------------------------------------------

revoke execute on function private.volunteer_interests_from(jsonb) from public;
revoke execute on function private.feedback_volunteer_workspace() from public;

-- Used inside a policy, so the roles policies run as need it
revoke execute on function private.my_volunteer_profile_id() from public;
grant execute on function private.my_volunteer_profile_id() to authenticated;

revoke execute on function public.register_volunteer(jsonb) from public, anon;
revoke execute on function public.set_my_volunteer_interests(jsonb) from public, anon;
grant execute on function public.register_volunteer(jsonb) to authenticated;
grant execute on function public.set_my_volunteer_interests(jsonb) to authenticated;
