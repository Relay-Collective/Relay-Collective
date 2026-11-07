-- CareRide driver enrollment for existing general volunteers (Phase 3, docs/architecture/volunteers.md).
-- Needs 20261104120100_general_volunteers.sql applied first.
--
-- One account, one volunteer identity, more than one way to take part. A general volunteer (role VOLUNTEER)
-- applies to drive from their volunteer workspace, on the same login, without registering again:
--
--   apply_to_careride()   inserts a PENDING drivers row through private.insert_driver() (the same validation as
--                         every other driver sign-up) and changes the profile's role to DRIVER, in one transaction.
--                         The profile id, the login, the volunteer profile and the interests are not touched.
--
-- Why the role changes now, and not on approval: every CareRide policy, RLS helper, ride function and app guard
-- already reads "DRIVER + a drivers row" as "enrolled in CareRide", and "status = 'APPROVED'" as "may drive".
-- A volunteer who applies is then exactly what a new driver from /onboarding/provider is: enrolled, pending,
-- unable to see or take a ride until a platform admin approves them with review_driver(). Nothing about
-- authorization changes, and no ride function has to learn a second way of being a driver.
--
-- Security:
--   * The identity comes from auth.uid(). The browser can't pass a profile, a status or a background.
--   * The row is always PENDING (private.insert_driver hard-codes it). Approval stays with review_driver(),
--     which only a platform admin may call.
--   * The browser still has no write grant on profiles.role or on drivers.status / applied_as_volunteer.
--   * Idempotent and race-safe: the same advisory lock as every onboarding path, the profile row locked
--     FOR UPDATE, and drivers.profile_id unique. A repeat returns the existing application instead of a second.
--   * Interests are still never read: choosing Transportation is neither required nor sufficient.

-- ---------------------------------------------------------------------------
-- drivers.applied_as_volunteer: true for a driver who enrolled from the volunteer workspace, so the admin
-- console can tell them apart from driver sign-ups and organization drivers. Descriptive only, set once,
-- never read for access. Readable like the rest of the row; not in the drivers column update grant.
-- ---------------------------------------------------------------------------

alter table public.drivers add column applied_as_volunteer boolean not null default false;

-- ---------------------------------------------------------------------------
-- apply_to_careride(): the signed-in general volunteer applies to drive with CareRide.
-- Returns {"driverId", "status", "created"}: created is false when the account had already applied.
--   * VOLUNTEER: a PENDING drivers row (vehicle, seats, wheelchair access, cities, request hours) and role DRIVER.
--     A phone number is required to drive. If the profile already has one it stays as it is (contact details
--     are changed by the Relay Collective team), otherwise the one given is checked and saved.
--   * DRIVER with a driver profile: already applied (a retry, a second tab, or an existing driver).
--     Returns that application unchanged, whatever its status: a decision is never reset from here.
--   * Anything else (no profile yet, organization staff, admins, a closed account) is refused.
-- Volunteer drivers drive as INDEPENDENT. Professional providers and organization drivers join other ways.
-- ---------------------------------------------------------------------------

create function public.apply_to_careride(p_details jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_driver public.drivers;
  v_driver_id uuid;
  v_phone text;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = 'P0001';
  end if;

  -- Same lock as the other onboarding paths, so two submissions for one login run one after the other
  perform pg_advisory_xact_lock(hashtextextended('careride-onboarding:' || v_uid::text, 0));

  select * into v_profile from public.profiles p where p.auth_user_id = v_uid for update;
  if not found then
    raise exception 'Join Relay Collective as a volunteer first.' using errcode = 'P0001';
  end if;
  if not v_profile.is_active then
    raise exception 'This account is closed.' using errcode = 'P0001';
  end if;

  if v_profile.role = 'DRIVER' then
    select * into v_driver from public.drivers d where d.profile_id = v_profile.id;
    if found then
      return jsonb_build_object('driverId', v_driver.id, 'status', v_driver.status, 'created', false);
    end if;
    -- A DRIVER account without its driver profile is inconsistent data: leave it for the team, invent nothing
    raise exception 'This account has no driver profile. Contact the Relay Collective team.' using errcode = 'P0001';
  end if;
  if v_profile.role <> 'VOLUNTEER' then
    raise exception 'This account can''t apply to drive with CareRide.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'Fill in your driver details.' using errcode = 'P0001';
  end if;

  v_phone := nullif(trim(coalesce(v_profile.phone, '')), '');
  if v_phone is null then
    v_phone := private.valid_phone(p_details ->> 'phone', 'Phone');
  end if;

  -- The checks every driver sign-up uses. The background is set here, never taken from the browser.
  v_driver_id := private.insert_driver(
    v_profile.id, null, (p_details - 'background') || jsonb_build_object('background', 'INDEPENDENT'), 'INDEPENDENT'
  );
  update public.drivers set applied_as_volunteer = true where id = v_driver_id;

  -- The same profile, now enrolled in CareRide. Its volunteer profile and interests stay exactly as they were.
  update public.profiles set role = 'DRIVER', phone = v_phone where id = v_profile.id;

  return jsonb_build_object('driverId', v_driver_id, 'status', 'PENDING', 'created', true);
end;
$$;

revoke execute on function public.apply_to_careride(jsonb) from public, anon;
grant execute on function public.apply_to_careride(jsonb) to authenticated;
