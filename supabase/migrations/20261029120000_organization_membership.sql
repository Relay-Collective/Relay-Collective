-- Organization discovery, membership requests, and team management.
--
-- Until now the only way into an existing organization was an invitation link. People can now search
-- the organizations that chose to be found, ask to join one, and wait for that organization's
-- administrators to decide. Invitations keep working exactly as before.
--
-- Membership stays where it already lives: a PARTNER profile with an org_id (one organization per
-- identity; see 20261024120000_identity_onboarding.sql). What's new:
--
--   profiles.org_role               ADMIN or STAFF, for PARTNER profiles only. ADMIN manages the team,
--                                   the organization's visibility, invitations and join requests.
--                                   STAFF uses the organization's services. Neither is a platform role:
--                                   PLATFORM_ADMIN is still only set by Relay Collective's own processes.
--   profiles.removed_at/removed_by  set when an administrator removes someone. The profile stays (it is on
--                                   rides and history) but loses its login link, so the person keeps
--                                   their identity and can join or start something else.
--   organizations.discoverability   'invitation_only' (default) or 'discoverable'. Only discoverable,
--                                   approved partner organizations are ever returned by search.
--   organization_join_requests      a person asking to join. pending -> approved | rejected | cancelled.
--   organization_membership_events  who did what to a request or a membership, and when.
--
-- Access
--   * The browser writes none of these tables directly. Every change is a function that works out the
--     caller from auth.uid() and their organization from their own profile, never from the browser.
--   * Applicants read their own requests; organization administrators read their organization's.
--     Review notes and reviewer ids aren't readable by applicants (column grants).
--   * Search is a function that returns name, city and a public description, for discoverable
--     organizations only, a few rows at a time. There is no new read access to organizations.
--   * "At least one administrator" is enforced by a trigger on profiles, under a lock on the
--     organization row, so no path (demotion, removal, closing an account) can leave a team without one.
--
-- Existing data
--   Every existing PARTNER profile becomes ADMIN. Until now every member could invite colleagues and
--   manage the organization's rides, so this keeps everyone's current abilities; administrators can make
--   colleagues STAFF afterwards. New members join as STAFF (by invitation) or with the role an
--   administrator picks (by request); the first member of a new organization, its applicant, is ADMIN.

-- ---------------------------------------------------------------------------
-- profiles: organization role and removal
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column org_role   text check (org_role in ('ADMIN', 'STAFF')),
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id);

update public.profiles set org_role = 'ADMIN' where role = 'PARTNER' and org_role is null;

alter table public.profiles
  add constraint profiles_org_role_for_partners check ((role = 'PARTNER') = (org_role is not null)),
  add constraint profiles_removed_pair check ((removed_at is null) = (removed_by is null)),
  add constraint profiles_removed_has_no_login check (removed_at is null or (auth_user_id is null and not is_active));

create index profiles_org_role_idx on public.profiles (org_id, org_role) where is_active;

-- Readable like the rest of a profile (the existing row policies decide whose).
grant select (org_role, removed_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- organizations: discoverability
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column discoverability       text not null default 'invitation_only'
                                     check (discoverability in ('discoverable', 'invitation_only')),
  -- Shown in search results. Written by the organization's administrators for the public; optional.
  add column directory_description text
                                     check (directory_description is null
                                            or (char_length(directory_description) between 1 and 280
                                                and directory_description = btrim(directory_description)));

-- Search scans only what can be found
create index organizations_discoverable_name_idx on public.organizations (lower(name))
  where discoverability = 'discoverable' and status = 'APPROVED' and type = 'PARTNER_ORG';

-- ---------------------------------------------------------------------------
-- organization_join_requests
-- ---------------------------------------------------------------------------

create table public.organization_join_requests (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id),
  -- The identity asking. A request belongs to a login, which has no profile yet; deleting the login
  -- deletes its requests (the events below keep what happened).
  user_id               uuid not null references auth.users (id) on delete cascade,
  -- Descriptive only ("Case worker"). Never used to decide what anyone can do.
  requested_position    text check (requested_position is null
                                    or (char_length(requested_position) between 1 and 120
                                        and requested_position = btrim(requested_position))),
  message               text check (message is null
                                    or (char_length(message) between 1 and 1000 and message = btrim(message))),
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- The role the reviewer granted. Chosen by an administrator, never by the applicant.
  assigned_role         text check (assigned_role in ('ADMIN', 'STAFF')),
  -- The membership approval created. Approved always means a membership exists.
  membership_profile_id uuid references public.profiles (id),
  reviewed_by           uuid references public.profiles (id),
  reviewed_at           timestamptz,
  -- For the organization's administrators only; applicants can't read it.
  review_note           text check (review_note is null
                                    or (char_length(review_note) between 1 and 500 and review_note = btrim(review_note))),
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint organization_join_requests_approved_has_membership
    check ((status = 'approved') = (membership_profile_id is not null and assigned_role is not null)),
  constraint organization_join_requests_reviewed
    check ((status in ('approved', 'rejected')) = (reviewed_at is not null and reviewed_by is not null)),
  constraint organization_join_requests_cancelled check ((status = 'cancelled') = (cancelled_at is not null))
);

-- One open request per person at a time. An identity can belong to one organization, so a second
-- pending request (to the same organization or another) is refused by the database itself.
create unique index organization_join_requests_one_pending
  on public.organization_join_requests (user_id) where status = 'pending';
create index organization_join_requests_org_status_idx
  on public.organization_join_requests (organization_id, status, created_at desc);
create index organization_join_requests_user_idx on public.organization_join_requests (user_id, created_at desc);

create trigger organization_join_requests_set_updated_at before update on public.organization_join_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_membership_events: the accountability trail for requests and memberships
-- ---------------------------------------------------------------------------

create table public.organization_membership_events (
  id                 bigint generated always as identity primary key,
  organization_id    uuid not null references public.organizations (id),
  request_id         uuid references public.organization_join_requests (id) on delete set null,
  subject_profile_id uuid references public.profiles (id),  -- the member, once there is one
  subject_user_id    uuid,                                     -- the login involved (kept if it's later deleted)
  actor_profile_id   uuid references public.profiles (id),   -- null: the applicant before joining, or Relay Collective itself
  actor_user_id      uuid,
  event_type         text not null check (event_type in (
                       'request_submitted', 'request_cancelled', 'request_approved', 'request_rejected',
                       'role_changed', 'member_removed', 'visibility_changed')),
  detail             jsonb not null default '{}',
  created_at         timestamptz not null default clock_timestamp()
);

create index organization_membership_events_org_idx on public.organization_membership_events (organization_id, id desc);
create index organization_membership_events_request_idx on public.organization_membership_events (request_id);

-- ---------------------------------------------------------------------------
-- Rate limits: a small counter per caller and window, for search and requests
-- ---------------------------------------------------------------------------

create table private.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

-- Counts one hit in the current window, refusing once there have been p_max. A refused call rolls its
-- own hit back, so the count settles at p_max until the window passes.
create function private.take_rate_limit(p_bucket text, p_max integer, p_window interval, p_message text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_seconds double precision := extract(epoch from p_window);
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  v_hits integer;
begin
  insert into private.rate_limits as r (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > p_max then
    raise exception '%', p_message using errcode = 'P0001';
  end if;
  delete from private.rate_limits where bucket = p_bucket and window_start < v_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The organization the caller administers: an active, signed-in ADMIN of a partner organization.
create function private.my_admin_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.org_id from public.profiles p
  where p.auth_user_id = (select auth.uid()) and p.is_active and p.role = 'PARTNER' and p.org_role = 'ADMIN'
$$;

-- A search term taken literally by LIKE: % and _ are just characters.
create function private.like_literal(p_text text)
returns text
language sql immutable set search_path = ''
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_')
$$;

create function private.log_membership_event(
  p_org_id uuid, p_event text, p_request_id uuid, p_subject_profile uuid, p_subject_user uuid, p_detail jsonb default '{}'
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.organization_membership_events
    (organization_id, request_id, subject_profile_id, subject_user_id, actor_profile_id, actor_user_id, event_type, detail)
  values (p_org_id, p_request_id, p_subject_profile, p_subject_user, private.my_profile_id(), (select auth.uid()), p_event, coalesce(p_detail, '{}'))
$$;

-- ---------------------------------------------------------------------------
-- Triggers on profiles
-- ---------------------------------------------------------------------------

-- A new partner member gets a role if the code creating it didn't pick one: the first active member of
-- an organization (its applicant) is ADMIN, anyone after that (an invited colleague) is STAFF.
create function private.profiles_default_org_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role = 'PARTNER' and new.org_role is null then
    new.org_role := case
      when exists (select 1 from public.profiles p
                   where p.org_id = new.org_id and p.role = 'PARTNER' and p.is_active and p.id <> new.id) then 'STAFF'
      else 'ADMIN'
    end;
  elsif new.role <> 'PARTNER' then
    new.org_role := null;
  end if;
  return new;
end;
$$;

create trigger profiles_default_org_role before insert on public.profiles
  for each row execute function private.profiles_default_org_role();

-- An organization that still has active members always keeps an active administrator. Applies to every
-- path: a role change, a removal, or the last administrator closing their own account. Platform admins
-- and server processes (no signed-in caller) may still act, e.g. to remove an abusive account.
-- The organization row is locked first, so two administrators demoting each other at the same moment
-- are handled one after the other, and the second sees the first's change.
create function private.keep_an_org_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not (old.role = 'PARTNER' and old.org_role = 'ADMIN' and old.is_active and old.auth_user_id is not null) then
    return new; -- wasn't an active administrator
  end if;
  if new.role = 'PARTNER' and new.org_role = 'ADMIN' and new.is_active and new.auth_user_id is not null
     and new.org_id is not distinct from old.org_id then
    return new; -- still is one
  end if;
  if (select auth.uid()) is null or private.is_admin() then
    return new;
  end if;

  perform 1 from public.organizations o where o.id = old.org_id for update;

  if not exists (select 1 from public.profiles p
                 where p.org_id = old.org_id and p.id <> old.id and p.role = 'PARTNER' and p.org_role = 'ADMIN'
                   and p.is_active and p.auth_user_id is not null)
     and exists (select 1 from public.profiles p
                 where p.org_id = old.org_id and p.id <> old.id and p.role = 'PARTNER' and p.is_active) then
    raise exception 'Your organization needs at least one administrator. Make another member an administrator first.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_keep_an_org_admin before update of org_role, is_active, auth_user_id, org_id, role on public.profiles
  for each row execute function private.keep_an_org_admin();

-- Someone who gets a role another way (an invitation, registering an organization, driving) no longer
-- needs a pending request: it's closed as cancelled. The request being approved right now is skipped.
create function private.close_requests_on_new_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_skip text := coalesce(current_setting('relay.approving_join_request', true), '');
  v_request record;
begin
  if new.auth_user_id is null then
    return new;
  end if;
  for v_request in
    update public.organization_join_requests r
       set status = 'cancelled', cancelled_at = now()
     where r.user_id = new.auth_user_id and r.status = 'pending' and r.id::text <> v_skip
    returning r.id, r.organization_id
  loop
    perform private.log_membership_event(v_request.organization_id, 'request_cancelled', v_request.id, null, new.auth_user_id,
                                         jsonb_build_object('reason', 'joined_elsewhere'));
  end loop;
  return new;
end;
$$;

create trigger profiles_close_join_requests after insert or update of auth_user_id on public.profiles
  for each row execute function private.close_requests_on_new_profile();

-- ---------------------------------------------------------------------------
-- Grants and row access
-- ---------------------------------------------------------------------------

revoke all on public.organization_join_requests, public.organization_membership_events from anon, authenticated;

alter table public.organization_join_requests enable row level security;
alter table public.organization_membership_events enable row level security;

-- review_note and reviewed_by are left out: applicants never read the reviewers' notes or who reviewed.
-- Administrators get both through list_join_requests().
grant select (id, organization_id, user_id, requested_position, message, status, assigned_role,
              reviewed_at, cancelled_at, created_at, updated_at)
  on public.organization_join_requests to authenticated;

create policy organization_join_requests_select on public.organization_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or organization_id = (select private.my_admin_org_id())
    or (select private.is_admin())
  );

grant select on public.organization_membership_events to authenticated;

create policy organization_membership_events_select on public.organization_membership_events
  for select to authenticated
  using (
    organization_id = (select private.my_admin_org_id())
    or (select private.is_admin())
  );

-- Invitations are now managed by the organization's administrators (who, after the backfill above, are
-- everyone who could manage them before).
drop policy organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.my_admin_org_id())
  );

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------

-- Organizations whose name contains the search, best matches first: names starting with it, then the
-- rest. Only approved, discoverable partner organizations that can take staff (they have a location).
-- Fewer than two characters returns nothing. Rate limited per caller.
create function public.search_organizations(p_query text, p_limit integer default 8)
returns table (id uuid, name text, city text, description text)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_pattern text;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;
  if char_length(v_query) < 2 then
    return;
  end if;
  perform private.take_rate_limit('org-search:' || v_uid::text, 40, interval '1 minute',
                                  'Too many searches in a short time. Please wait a moment and try again.');
  v_pattern := private.like_literal(lower(v_query));

  return query
    select o.id, o.name, h.city, o.directory_description
    from public.organizations o
    join public.houses h on h.org_id = o.id
    where o.status = 'APPROVED' and o.type = 'PARTNER_ORG' and o.discoverability = 'discoverable'
      and lower(o.name) like '%' || v_pattern || '%'
    order by (lower(o.name) like v_pattern || '%') desc, lower(o.name), o.id
    limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applicants
-- ---------------------------------------------------------------------------

-- Asks to join an organization found in search. Returns the request id. Repeating it (a retry, a second
-- tab) returns the same pending request. Grants nothing: an administrator decides.
create function public.submit_join_request(p_org_id uuid, p_position text default null, p_message text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_pending public.organization_join_requests;
  v_position text := nullif(btrim(coalesce(p_position, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  -- The same lock as every other onboarding path, so a request can't race an invitation or a sign-up.
  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  if (select u.email_confirmed_at from auth.users u where u.id = v_uid) is null then
    raise exception 'Please confirm your email address before asking to join an organization.' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles p where p.auth_user_id = v_uid;
  if found then
    if v_profile.is_active and v_profile.org_id = p_org_id then
      raise exception 'You''re already a member of this organization.' using errcode = 'P0001';
    end if;
    raise exception 'This account already has a Relay Collective role, and an account can belong to one organization.'
      using errcode = 'P0001';
  end if;

  -- Same answer for an organization that doesn't exist, isn't approved, or isn't discoverable.
  if not exists (select 1 from public.organizations o join public.houses h on h.org_id = o.id
                 where o.id = p_org_id and o.status = 'APPROVED' and o.type = 'PARTNER_ORG'
                   and o.discoverability = 'discoverable') then
    raise exception 'This organization isn''t accepting requests to join right now.' using errcode = 'P0001';
  end if;

  select * into v_pending from public.organization_join_requests r where r.user_id = v_uid and r.status = 'pending';
  if found then
    if v_pending.organization_id = p_org_id then
      return v_pending.id;
    end if;
    raise exception 'You already have a request waiting with another organization. Withdraw it first to ask somewhere else.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from public.organization_join_requests r
      where r.user_id = v_uid and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'You''ve sent several requests today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  if char_length(v_position) > 120 then
    raise exception 'Keep your role or position under 120 characters.' using errcode = 'P0001';
  end if;
  if char_length(v_message) > 1000 then
    raise exception 'Keep your message under 1,000 characters.' using errcode = 'P0001';
  end if;

  insert into public.organization_join_requests (organization_id, user_id, requested_position, message)
  values (p_org_id, v_uid, v_position, v_message)
  returning id into v_id;

  perform private.log_membership_event(p_org_id, 'request_submitted', v_id, null, v_uid);
  return v_id;
end;
$$;

-- Withdraws the caller's own pending request. Never touches a membership.
create function public.cancel_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;
  update public.organization_join_requests r
     set status = 'cancelled', cancelled_at = now()
   where r.id = p_request_id and r.user_id = auth.uid() and r.status = 'pending'
  returning r.organization_id into v_org_id;
  if not found then
    raise exception 'This request can''t be withdrawn. It may already have been reviewed.' using errcode = 'P0001';
  end if;
  perform private.log_membership_event(v_org_id, 'request_cancelled', p_request_id, null, auth.uid());
end;
$$;

-- The caller's recent requests, newest first, with the organization's name (which RLS on organizations
-- would hide from someone who isn't a member yet). Never the reviewers' notes.
create function public.my_join_requests()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by item ->> 'createdAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
      'orgId', r.organization_id,
      'orgName', o.name,
      'orgCity', (select h.city from public.houses h where h.org_id = o.id),
      'status', r.status,
      'requestedPosition', r.requested_position,
      'message', r.message,
      'createdAt', r.created_at,
      'reviewedAt', r.reviewed_at,
      'cancelledAt', r.cancelled_at
    ) as item
    from public.organization_join_requests r
    join public.organizations o on o.id = r.organization_id
    where r.user_id = (select auth.uid())
    order by r.created_at desc
    limit 10
  ) recent
$$;

-- ---------------------------------------------------------------------------
-- Organization administrators: requests
-- ---------------------------------------------------------------------------

-- The administrator's own organization's requests ('pending', 'approved', 'rejected', 'cancelled' or 'all'),
-- with what they need to decide: the applicant's name, sign-in email and whether it's confirmed.
create function public.list_join_requests(p_status text default 'pending')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can see requests to join.' using errcode = 'P0001';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'all') then
    raise exception 'Unknown request status.' using errcode = 'P0001';
  end if;
  return (
    select coalesce(jsonb_agg(item order by item ->> 'createdAt' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', r.id,
        'orgId', r.organization_id,
        'applicantName', coalesce(private.identity_name(r.user_id), 'Applicant'),
        'applicantEmail', u.email,
        'emailVerified', u.email_confirmed_at is not null,
        'requestedPosition', r.requested_position,
        'message', r.message,
        'status', r.status,
        'assignedRole', r.assigned_role,
        'reviewNote', r.review_note,
        'reviewedByName', (select p.name from public.profiles p where p.id = r.reviewed_by),
        'reviewedAt', r.reviewed_at,
        'createdAt', r.created_at
      ) as item
      from public.organization_join_requests r
      join auth.users u on u.id = r.user_id
      where r.organization_id = v_org_id and (p_status = 'all' or r.status = p_status)
      order by r.created_at desc
      limit 200
    ) rows
  );
end;
$$;

-- Approves a pending request and creates the membership in one transaction. The role is the
-- administrator's choice (ADMIN or STAFF). Two administrators approving at once: the second is told it's
-- already approved, and the unique login on profiles makes a second membership impossible either way.
create function public.approve_join_request(p_request_id uuid, p_role text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_user_id uuid;
  v_request public.organization_join_requests;
  v_house_id uuid;
  v_profile_id uuid;
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can review requests to join.' using errcode = 'P0001';
  end if;
  if p_role is null or p_role not in ('ADMIN', 'STAFF') then
    raise exception 'Choose a role for this member.' using errcode = 'P0001';
  end if;

  -- The applicant's onboarding lock first, then the request row: the same order as every path that
  -- creates a profile, so an approval and an invitation accepted at the same moment can't deadlock.
  select r.user_id into v_user_id from public.organization_join_requests r
   where r.id = p_request_id and r.organization_id = v_org_id;
  if v_user_id is null then
    raise exception 'This request wasn''t found.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_user_id::text, 0));

  select * into v_request from public.organization_join_requests r where r.id = p_request_id for update;
  if v_request.status <> 'pending' then
    raise exception 'This request was already %. Refresh to see the latest.',
      case v_request.status when 'approved' then 'approved' when 'rejected' then 'declined' else 'withdrawn' end
      using errcode = 'P0001';
  end if;
  if (select o.status from public.organizations o where o.id = v_org_id) is distinct from 'APPROVED' then
    raise exception 'Your organization needs to be approved before it can add members.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.auth_user_id = v_user_id) then
    raise exception 'This person already has a Relay Collective role, so they can''t join through this request.'
      using errcode = 'P0001';
  end if;
  select h.id into v_house_id from public.houses h where h.org_id = v_org_id;
  if v_house_id is null then
    raise exception 'Your organization isn''t set up for staff yet. Contact Relay Collective.' using errcode = 'P0001';
  end if;

  perform set_config('relay.approving_join_request', p_request_id::text, true);

  insert into public.profiles (auth_user_id, name, email, role, org_id, house_id, org_role)
  values (
    v_user_id,
    coalesce(private.identity_name(v_user_id), 'Member'),
    (select lower(u.email) from auth.users u where u.id = v_user_id),
    'PARTNER', v_org_id, v_house_id, p_role
  )
  returning id into v_profile_id;

  update public.organization_join_requests
     set status = 'approved', assigned_role = p_role, membership_profile_id = v_profile_id,
         reviewed_by = private.my_profile_id(), reviewed_at = now()
   where id = p_request_id;

  perform set_config('relay.approving_join_request', '', true);
  perform private.log_membership_event(v_org_id, 'request_approved', p_request_id, v_profile_id, v_user_id,
                                       jsonb_build_object('role', p_role));
  return v_profile_id;
end;
$$;

-- Declines a pending request. The optional note stays with the organization's administrators.
create function public.reject_join_request(p_request_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_request public.organization_join_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can review requests to join.' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'P0001';
  end if;
  select * into v_request from public.organization_join_requests r
   where r.id = p_request_id and r.organization_id = v_org_id
   for update;
  if not found then
    raise exception 'This request wasn''t found.' using errcode = 'P0001';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request was already reviewed or withdrawn. Refresh to see the latest.' using errcode = 'P0001';
  end if;

  update public.organization_join_requests
     set status = 'rejected', review_note = v_note, reviewed_by = private.my_profile_id(), reviewed_at = now()
   where id = p_request_id;
  perform private.log_membership_event(v_org_id, 'request_rejected', p_request_id, null, v_request.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Organization administrators: members
-- ---------------------------------------------------------------------------

-- The caller's organization's members. Every member sees names and roles; only administrators see
-- sign-in emails. Former members (removed, or closed their account) only when asked for.
create function public.list_organization_members(p_include_former boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me public.profiles;
  v_admin boolean;
begin
  select * into v_me from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active and p.role = 'PARTNER';
  if not found then
    raise exception 'Only members of a partner organization can see its team.' using errcode = 'P0001';
  end if;
  v_admin := v_me.org_role = 'ADMIN';
  return (
    select coalesce(jsonb_agg(item order by item ->> 'status', item ->> 'name'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', case when v_admin then coalesce(u.email, p.email) end,
        'role', p.org_role,
        'status', case when p.removed_at is not null then 'removed'
                       when p.is_active and p.auth_user_id is not null then 'active'
                       else 'closed' end,
        'joinedAt', p.created_at,
        'removedAt', p.removed_at,
        'isYou', p.id = v_me.id
      ) as item
      from public.profiles p
      left join auth.users u on u.id = p.auth_user_id
      where p.org_id = v_me.org_id and p.role = 'PARTNER'
        and (p_include_former or (p.is_active and p.auth_user_id is not null))
    ) rows
  );
end;
$$;

-- Changes another member's organization role. Administrators can't change their own role here (another
-- administrator has to), and the keep_an_org_admin trigger refuses losing the last one.
create function public.set_member_role(p_profile_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_member public.profiles;
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can change roles.' using errcode = 'P0001';
  end if;
  if p_role is null or p_role not in ('ADMIN', 'STAFF') then
    raise exception 'Choose a role.' using errcode = 'P0001';
  end if;
  select * into v_member from public.profiles p
   where p.id = p_profile_id and p.org_id = v_org_id and p.role = 'PARTNER' and p.is_active and p.auth_user_id is not null
   for update;
  if not found then
    raise exception 'This person isn''t an active member of your organization.' using errcode = 'P0001';
  end if;
  if v_member.id = private.my_profile_id() then
    raise exception 'You can''t change your own role. Ask another administrator.' using errcode = 'P0001';
  end if;
  if v_member.org_role = p_role then
    return;
  end if;

  update public.profiles set org_role = p_role where id = v_member.id;
  perform private.log_membership_event(v_org_id, 'role_changed', null, v_member.id, v_member.auth_user_id,
                                       jsonb_build_object('from', v_member.org_role, 'to', p_role));
end;
$$;

-- Removes someone from the organization. Their profile stays on past rides but no longer has a login, so
-- they lose access straight away; their login itself is untouched (they can join somewhere else, or ask
-- to rejoin). Administrators can't remove themselves.
create function public.remove_member(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_actor uuid := private.my_profile_id();
  v_member public.profiles;
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can remove members.' using errcode = 'P0001';
  end if;
  select * into v_member from public.profiles p
   where p.id = p_profile_id and p.org_id = v_org_id and p.role = 'PARTNER' and p.is_active and p.auth_user_id is not null
   for update;
  if not found then
    raise exception 'This person isn''t an active member of your organization.' using errcode = 'P0001';
  end if;
  if v_member.id = v_actor then
    raise exception 'You can''t remove yourself. Ask another administrator.' using errcode = 'P0001';
  end if;

  update public.profiles
     set is_active = false, auth_user_id = null, removed_at = now(), removed_by = v_actor
   where id = v_member.id;
  perform private.log_membership_event(v_org_id, 'member_removed', null, v_member.id, v_member.auth_user_id,
                                       jsonb_build_object('role', v_member.org_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Organization administrators: visibility
-- ---------------------------------------------------------------------------

-- Whether the organization can be found in search, and what search shows about it. Only an approved
-- organization can become discoverable. Existing members are unaffected either way.
create function public.set_organization_visibility(p_discoverability text, p_description text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_org public.organizations;
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can change its visibility.' using errcode = 'P0001';
  end if;
  if p_discoverability is null or p_discoverability not in ('discoverable', 'invitation_only') then
    raise exception 'Choose who can find your organization.' using errcode = 'P0001';
  end if;
  if char_length(v_description) > 280 then
    raise exception 'Keep the description under 280 characters.' using errcode = 'P0001';
  end if;
  select * into v_org from public.organizations o where o.id = v_org_id for update;
  if p_discoverability = 'discoverable' and v_org.status <> 'APPROVED' then
    raise exception 'Your organization can be found in search once Relay Collective approves it.' using errcode = 'P0001';
  end if;

  update public.organizations
     set discoverability = p_discoverability, directory_description = v_description
   where id = v_org_id;
  if v_org.discoverability <> p_discoverability then
    perform private.log_membership_event(v_org_id, 'visibility_changed', null, null, null,
                                         jsonb_build_object('from', v_org.discoverability, 'to', p_discoverability));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations: now created and withdrawn by administrators. Otherwise unchanged; an invited colleague
-- joins as STAFF (profiles_default_org_role), the least-privileged role.
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_admin_org_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_org_id is null then
    raise exception 'Only your organization''s administrators can invite colleagues.' using errcode = 'P0001';
  end if;
  if (select o.status from public.organizations o where o.id = v_org_id) is distinct from 'APPROVED' then
    raise exception 'You can invite colleagues once your organization is approved.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('careride-invitations:' || v_org_id::text, 0));

  update public.organization_invitations
     set revoked_at = now()
   where org_id = v_org_id and email = v_email and accepted_at is null and revoked_at is null;

  if (select count(*) from public.organization_invitations i
      where i.org_id = v_org_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) >= 25 then
    raise exception 'Your organization has 25 open invitations. Revoke some before sending more.' using errcode = 'P0001';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.organization_invitations (org_id, email, role, token_hash, invited_by, expires_at)
  values (v_org_id, v_email, 'PARTNER', private.invitation_token_hash(v_token), private.my_profile_id(), v_expires)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'expiresAt', v_expires);
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.organization_invitations i
     set revoked_at = now()
   where i.id = p_invitation_id
     and i.accepted_at is null
     and i.revoked_at is null
     and (i.org_id = private.my_admin_org_id() or private.is_admin());
  if not found then
    raise exception 'That invitation can''t be withdrawn. It may already be used or withdrawn.' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions: signed-in users only. Internal helpers are not callable from the API.
-- ---------------------------------------------------------------------------

revoke all on private.rate_limits from public, anon, authenticated;

revoke execute on function private.take_rate_limit(text, integer, interval, text) from public;
revoke execute on function private.like_literal(text) from public;
revoke execute on function private.log_membership_event(uuid, text, uuid, uuid, uuid, jsonb) from public;
revoke execute on function private.profiles_default_org_role() from public;
revoke execute on function private.keep_an_org_admin() from public;
revoke execute on function private.close_requests_on_new_profile() from public;
-- Used inside row policies, like the other private.my_* helpers
revoke execute on function private.my_admin_org_id() from public;
grant execute on function private.my_admin_org_id() to authenticated;

revoke execute on function public.search_organizations(text, integer) from public, anon;
revoke execute on function public.submit_join_request(uuid, text, text) from public, anon;
revoke execute on function public.cancel_join_request(uuid) from public, anon;
revoke execute on function public.my_join_requests() from public, anon;
revoke execute on function public.list_join_requests(text) from public, anon;
revoke execute on function public.approve_join_request(uuid, text) from public, anon;
revoke execute on function public.reject_join_request(uuid, text) from public, anon;
revoke execute on function public.list_organization_members(boolean) from public, anon;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.set_organization_visibility(text, text) from public, anon;

grant execute on function public.search_organizations(text, integer) to authenticated;
grant execute on function public.submit_join_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_join_request(uuid) to authenticated;
grant execute on function public.my_join_requests() to authenticated;
grant execute on function public.list_join_requests(text) to authenticated;
grant execute on function public.approve_join_request(uuid, text) to authenticated;
grant execute on function public.reject_join_request(uuid, text) to authenticated;
grant execute on function public.list_organization_members(boolean) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.set_organization_visibility(text, text) to authenticated;

-- Applicants see their request decided, and administrators see new requests, without reloading
alter publication supabase_realtime add table public.organization_join_requests;
