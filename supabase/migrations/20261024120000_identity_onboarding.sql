-- Individual identities, organization applications, and staff invitations.
--
-- Until now a Relay Collective account was born in one step: Auth signUp carried the whole
-- registration form in its metadata, and complete_onboarding() turned it into a profile.
-- Sign-up now creates only the identity (the Auth login). The person then chooses what to do:
--
--   * submit_organization_application(): register a partner organization. Builds the pending
--     organization, its location, the applicant's PARTNER profile, and the application details.
--   * register_driver_profile(): become a volunteer driver. Builds a DRIVER profile and a pending driver.
--   * accept_invitation(): join an approved organization as a staff member, from a link a member sent.
--
-- What each concept maps to (unchanged tables, so existing accounts keep working):
--   identity          auth.users                         who someone is; owns the login
--   membership        profiles.org_id + role PARTNER     one organization per identity, decided server-side
--   platform role     profiles.role = PLATFORM_ADMIN     only ever set by existing admin processes
--   service role      drivers row (status)               transportation; approval stays with admins
--
-- complete_onboarding() stays, so a sign-up that started before this change (details in metadata)
-- still finishes on first sign-in. Nothing here grants access from a choice made in the browser:
-- organizations and drivers start PENDING, and only a platform admin approves them.

-- ---------------------------------------------------------------------------
-- organization_applications: what an organization told us when it applied.
-- Kept apart from organizations, which drivers on a ride can read: contact emails stay with
-- the organization's own members and the platform admins.
-- ---------------------------------------------------------------------------

create table public.organization_applications (
  org_id             uuid primary key references public.organizations (id),
  kind               text not null
                       check (kind in ('NONPROFIT', 'COMMUNITY_GROUP', 'FAITH_BASED', 'PUBLIC_AGENCY', 'OTHER')),
  website            text check (website is null or char_length(website) <= 300),
  description        text not null check (char_length(trim(description)) between 1 and 1000),
  contact_email      text not null check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_role       text not null check (char_length(trim(contact_role)) between 1 and 120),
  -- Descriptive only. Never used to decide what anyone can do.
  service_categories text[] not null default '{}' check (cardinality(service_categories) <= 12),
  platform_interests text[] not null default '{}' check (cardinality(platform_interests) <= 12),
  submitted_by       uuid not null references public.profiles (id),
  submitted_at       timestamptz not null default now()
);

alter table public.organization_applications enable row level security;

grant select on public.organization_applications to authenticated;

create policy organization_applications_select on public.organization_applications
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.my_managed_org_id())
  );

-- ---------------------------------------------------------------------------
-- organization_invitations: a member of an approved organization invites a colleague by email.
-- Only a hash of the token is stored; the link itself is shown once, to the person who made it.
-- ---------------------------------------------------------------------------

create table public.organization_invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  email       text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Staff of a partner organization. There is no higher organization role to invite anyone into.
  role        public.user_role not null default 'PARTNER' check (role = 'PARTNER'),
  token_hash  bytea not null unique,
  invited_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at  timestamptz,
  constraint organization_invitations_expiry_after_created check (expires_at > created_at),
  constraint organization_invitations_accepted_pair check ((accepted_at is null) = (accepted_by is null))
);

create index organization_invitations_org_id_idx on public.organization_invitations (org_id);

alter table public.organization_invitations enable row level security;

-- token_hash is left out: nobody reads it back, not even the organization that made it.
grant select (id, org_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.organization_invitations to authenticated;

create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.my_managed_org_id())
  );

create function private.invitation_token_hash(p_token text)
returns bytea
language sql immutable set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
$$;

-- The name to give a new profile: what they typed at sign-up, else the start of their email.
create function private.identity_name(p_uid uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)), 200)
  from auth.users u where u.id = p_uid
$$;

-- ---------------------------------------------------------------------------
-- my_account_state(): NONE (a login with no profile yet: onboarding), INACTIVE (closed), or ACTIVE.
-- Lets the app tell a new identity apart from a closed account, which profiles RLS hides alike.
-- ---------------------------------------------------------------------------

create function public.my_account_state()
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'NONE'
    when not exists (select 1 from public.profiles p where p.auth_user_id = (select auth.uid())) then 'NONE'
    when exists (select 1 from public.profiles p where p.auth_user_id = (select auth.uid()) and p.is_active) then 'ACTIVE'
    else 'INACTIVE'
  end
$$;

-- ---------------------------------------------------------------------------
-- submit_organization_application(): the caller registers a partner organization.
-- Returns the caller's profile id. Repeating the call (a retry, a second tab) returns the same
-- profile instead of creating a second organization.
-- ---------------------------------------------------------------------------

create function public.submit_organization_application(p_details jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
  v_org_id uuid;
  v_house_id uuid;
  v_profile_id uuid;
  v_org_name text;
  v_phone text;
  v_website text;
  v_categories text[];
  v_interests text[];
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  -- Same lock as complete_onboarding(), so no two onboarding paths can race for one login.
  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  select * into v_profile from public.profiles p where p.auth_user_id = v_uid;
  if found then
    if v_profile.role = 'PARTNER' and v_profile.is_active
       and exists (select 1 from public.organization_applications a
                   where a.org_id = v_profile.org_id and a.submitted_by = v_profile.id) then
      return v_profile.id; -- already submitted: the earlier application stands
    end if;
    raise exception 'This account already has a Relay Collective role, so it can''t register another organization.'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'Fill in your organization''s details.' using errcode = 'P0001';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  v_org_name := private.required_text(p_details ->> 'orgName', 'Organization name');
  v_phone := private.required_text(p_details ->> 'contactPhone', 'Phone', 40);
  v_website := nullif(trim(coalesce(p_details ->> 'website', '')), '');
  if v_website is not null and v_website !~* '^https?://[^\s/]+\.[^\s]+$' then
    raise exception 'Check the website address.' using errcode = 'P0001';
  end if;

  -- Only known values are kept: categories and interests describe the organization, nothing more.
  select coalesce(array_agg(distinct c), '{}') into v_categories
    from jsonb_array_elements_text(coalesce(p_details -> 'serviceCategories', '[]'::jsonb)) as c
    where c in ('HOUSING', 'FOOD', 'HEALTH', 'TRANSPORTATION', 'OUTREACH', 'EMPLOYMENT', 'OTHER');
  if cardinality(v_categories) = 0 then
    raise exception 'Choose at least one kind of work your organization does.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct i), '{}') into v_interests
    from jsonb_array_elements_text(coalesce(p_details -> 'platformInterests', '[]'::jsonb)) as i
    where i in ('TRANSPORTATION', 'VOLUNTEERS', 'RESOURCES', 'REFERRALS', 'REPORTING');

  insert into public.organizations (name, type, contact_name, contact_phone, status)
  values (v_org_name, 'PARTNER_ORG', private.required_text(p_details ->> 'contactName', 'Contact name'), v_phone, 'PENDING')
  returning id into v_org_id;

  -- A partner organization has one location: where its rides start.
  insert into public.houses (org_id, name, address, city, phone)
  values (
    v_org_id,
    v_org_name,
    private.required_text(p_details ->> 'address', 'Address', 300),
    private.required_text(p_details ->> 'city', 'City', 100),
    v_phone
  )
  returning id into v_house_id;

  -- The applicant's own profile carries their name, not the organization's: accounts are per person now.
  insert into public.profiles (auth_user_id, name, phone, email, role, org_id, house_id)
  values (v_uid, private.identity_name(v_uid), v_phone, v_email, 'PARTNER', v_org_id, v_house_id)
  returning id into v_profile_id;

  insert into public.organization_applications (
    org_id, kind, website, description, contact_email, contact_role, service_categories, platform_interests, submitted_by
  ) values (
    v_org_id,
    coalesce(nullif(p_details ->> 'kind', ''), 'NONPROFIT'),
    v_website,
    private.required_text(p_details ->> 'description', 'Description', 1000),
    lower(private.required_text(p_details ->> 'contactEmail', 'Contact email', 254)),
    private.required_text(p_details ->> 'contactRole', 'Your role', 120),
    v_categories,
    v_interests,
    v_profile_id
  );

  return v_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- register_driver_profile(): the caller signs up as a volunteer driver. Same checks as the
-- driver sign-up in complete_onboarding(); the driver starts PENDING until an admin verifies them.
-- ---------------------------------------------------------------------------

create function public.register_driver_profile(p_details jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_profile_id uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  select * into v_profile from public.profiles p where p.auth_user_id = v_uid;
  if found then
    if v_profile.role = 'DRIVER' and v_profile.is_active then
      return v_profile.id;
    end if;
    raise exception 'This account already has a Relay Collective role, so it can''t also sign up as a driver.'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'Fill in your driver details.' using errcode = 'P0001';
  end if;

  insert into public.profiles (auth_user_id, name, phone, email, role)
  values (
    v_uid,
    private.required_text(p_details ->> 'name', 'Your name'),
    private.required_text(p_details ->> 'phone', 'Phone', 40),
    (select u.email from auth.users u where u.id = v_uid),
    'DRIVER'
  )
  returning id into v_profile_id;

  -- Self sign-up never joins a transport provider: org_id stays null.
  perform private.insert_driver(v_profile_id, null, p_details, 'INDEPENDENT');

  return v_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

-- A staff member of an approved partner organization invites a colleague. The organization is the
-- caller's own, never a value from the browser. Returns the link token once; only its hash is kept.
create function public.create_invitation(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid := private.my_managed_org_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_org_id is null or private.my_role() <> 'PARTNER' then
    raise exception 'Only staff of a partner organization can invite colleagues.' using errcode = 'P0001';
  end if;
  if (select o.status from public.organizations o where o.id = v_org_id) is distinct from 'APPROVED' then
    raise exception 'You can invite colleagues once your organization is approved.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = 'P0001';
  end if;

  -- Serialise invitations per organization so the open-invitation cap holds under concurrent calls.
  perform pg_advisory_xact_lock(hashtextextended('careride-invitations:' || v_org_id::text, 0));

  -- A new invitation to the same person replaces any earlier open one.
  update public.organization_invitations
     set revoked_at = now()
   where org_id = v_org_id and email = v_email and accepted_at is null and revoked_at is null;

  if (select count(*) from public.organization_invitations i
      where i.org_id = v_org_id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) >= 25 then
    raise exception 'Your organization has 25 open invitations. Revoke some before sending more.' using errcode = 'P0001';
  end if;

  -- 244 random bits from two v4 UUIDs (gen_random_uuid uses the strong random source).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.organization_invitations (org_id, email, role, token_hash, invited_by, expires_at)
  values (v_org_id, v_email, 'PARTNER', private.invitation_token_hash(v_token), private.my_profile_id(), v_expires)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'expiresAt', v_expires);
end;
$$;

-- What the person opening a link may see. Signed-in callers only, and only for a token they hold.
-- An invitation meant for someone else says so without naming the organization.
create function public.get_invitation(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.organization_invitations;
  v_email text;
  v_state text;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  select * into v_inv from public.organization_invitations i where i.token_hash = private.invitation_token_hash(p_token);
  if not found then
    return jsonb_build_object('state', 'INVALID');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  v_state := case
    when v_inv.revoked_at is not null then 'REVOKED'
    when v_inv.accepted_at is not null then 'USED'
    when v_inv.expires_at <= now() then 'EXPIRED'
    when v_inv.email <> v_email then 'WRONG_ACCOUNT'
    when exists (select 1 from public.profiles p where p.auth_user_id = v_uid) then 'HAS_ACCOUNT'
    when (select o.status from public.organizations o where o.id = v_inv.org_id) is distinct from 'APPROVED' then 'UNAVAILABLE'
    else 'VALID'
  end;

  if v_state in ('INVALID', 'REVOKED', 'USED', 'EXPIRED', 'UNAVAILABLE') then
    return jsonb_build_object('state', v_state);
  end if;
  if v_state = 'WRONG_ACCOUNT' then
    -- Enough to recognise which inbox it went to, not enough to learn the address.
    return jsonb_build_object('state', v_state, 'emailHint', left(v_inv.email, 1) || '•••@' || split_part(v_inv.email, '@', 2));
  end if;

  return jsonb_build_object(
    'state', v_state,
    'orgName', (select o.name from public.organizations o where o.id = v_inv.org_id),
    'role', v_inv.role,
    'invitedBy', (select p.name from public.profiles p where p.id = v_inv.invited_by),
    'email', v_inv.email,
    'expiresAt', v_inv.expires_at
  );
end;
$$;

-- Accepts an invitation for the signed-in identity. Every check runs again here under a row lock,
-- so a link can't be used twice, after it expires, after it's revoked, or by another account.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.organization_invitations;
  v_email text;
  v_house_id uuid;
  v_profile_id uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  select * into v_inv from public.organization_invitations i
   where i.token_hash = private.invitation_token_hash(p_token)
   for update;
  if not found then
    raise exception 'This invitation link isn''t valid.' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'This invitation was withdrawn. Ask your organization for a new one.' using errcode = 'P0001';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired. Ask your organization for a new one.' using errcode = 'P0001';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_inv.email <> v_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.auth_user_id = v_uid) then
    raise exception 'This account already belongs to Relay Collective, and an account can join one organization.'
      using errcode = 'P0001';
  end if;
  if (select o.status from public.organizations o where o.id = v_inv.org_id) is distinct from 'APPROVED' then
    raise exception 'This organization isn''t accepting new members right now.' using errcode = 'P0001';
  end if;

  select h.id into v_house_id from public.houses h where h.org_id = v_inv.org_id;
  if v_house_id is null then
    raise exception 'This organization isn''t set up for staff yet. Contact Relay Collective.' using errcode = 'P0001';
  end if;

  insert into public.profiles (auth_user_id, name, email, role, org_id, house_id)
  values (v_uid, private.identity_name(v_uid), v_email, v_inv.role, v_inv.org_id, v_house_id)
  returning id into v_profile_id;

  update public.organization_invitations
     set accepted_at = now(), accepted_by = v_profile_id
   where id = v_inv.id;

  return v_profile_id;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.organization_invitations i
     set revoked_at = now()
   where i.id = p_invitation_id
     and i.accepted_at is null
     and i.revoked_at is null
     and (i.org_id = private.my_managed_org_id() or private.is_admin());
  if not found then
    raise exception 'That invitation can''t be withdrawn. It may already be used or withdrawn.' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- deactivate_my_account(): with individual staff accounts, one person leaving must not cancel
-- the whole organization's rides. Only the last active member closing their account does that.
-- (Otherwise unchanged from the ride-safeguards migration.)
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
  if v_profile.role not in ('DRIVER', 'PARTNER') then
    raise exception 'This account can''t be closed from here.' using errcode = 'P0001';
  end if;
  if not v_profile.is_active then
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
-- Execute permissions: signed-in users only. Internal helpers are not callable from the API.
-- ---------------------------------------------------------------------------

revoke execute on function private.invitation_token_hash(text) from public;
revoke execute on function private.identity_name(uuid) from public;

revoke execute on function public.my_account_state() from public, anon;
revoke execute on function public.submit_organization_application(jsonb) from public, anon;
revoke execute on function public.register_driver_profile(jsonb) from public, anon;
revoke execute on function public.create_invitation(text) from public, anon;
revoke execute on function public.get_invitation(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;

grant execute on function public.my_account_state() to authenticated;
grant execute on function public.submit_organization_application(jsonb) to authenticated;
grant execute on function public.register_driver_profile(jsonb) to authenticated;
grant execute on function public.create_invitation(text) to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Members see invitations come and go without reloading
alter publication supabase_realtime add table public.organization_invitations;
