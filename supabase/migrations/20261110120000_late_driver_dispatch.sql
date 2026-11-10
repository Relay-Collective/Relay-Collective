-- Drivers who become able to take an open request after it went out are asked too.
--
-- The bug (stakeholder testing, 2026-11-09): dispatch() only ran when a ride was booked, and the per-minute job only
-- looked again at SEARCHING rides or at rides whose offers had all timed out. Once one driver had a PENDING offer the
-- ride sat in OFFERED, and nobody else could join it until that offer expired (5 minutes on demand, 60 scheduled).
-- So a driver approved after the ride was booked, a driver who turned on their request hours or added the pickup
-- city, or a brand new driver account never saw the request, while the driver who was eligible at booking did.
--
-- Now:
--   * private.ask_new_drivers(ride) sends an OFFERED ride to every driver who can take it now and hasn't been asked
--     in this round. Everyone still deciding keeps their offer; the first to accept gets the ride, as before.
--     A preferred driver (the outbound driver of a return trip) being asked alone first keeps it to themselves.
--   * The per-minute job runs it for every OFFERED ride, so request hours that open mid-request count too.
--   * Approving a driver, or a driver changing their request hours or cities, runs it straight away.
-- Matches driversToAddToOpenRide() in src/logic/dispatch.ts.

-- ---------------------------------------------------------------------------
-- Asking drivers who weren't asked when the ride went out
-- ---------------------------------------------------------------------------

-- Returns how many drivers were newly asked. Takes the ride lock itself.
create function private.ask_new_drivers(p_ride_id uuid)
returns integer
language plpgsql set search_path = ''
as $$
declare
  r public.rides;
  v_before integer;
  v_after integer;
begin
  select * into r from public.rides where id = p_ride_id for update;
  if not found or r.status <> 'OFFERED' then
    return 0;
  end if;

  -- A return trip goes to the outbound driver alone first. Others join only once they've answered.
  if r.preferred_driver_id is not null and exists (
    select 1 from public.ride_offers o
    where o.ride_id = r.id and o.driver_id = r.preferred_driver_id and o.status = 'PENDING'
  ) then
    return 0;
  end if;

  select count(*) into v_before from public.ride_offers o where o.ride_id = r.id and o.status = 'PENDING';
  -- dispatch() skips everyone already asked in this round and leaves the ride OFFERED while anyone is deciding
  perform private.dispatch(r.id);
  select count(*) into v_after from public.ride_offers o where o.ride_id = r.id and o.status = 'PENDING';
  return v_after - v_before;
end;
$$;

-- ---------------------------------------------------------------------------
-- The per-minute job also looks at every OFFERED ride
-- ---------------------------------------------------------------------------

create or replace function private.process_ride_deadlines(p_batch integer default 200)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_run_id bigint;
  v_now timestamptz := now();
  v_ride public.rides;
  v_expired integer;
  v_offers_expired integer := 0;
  v_dispatched integer := 0;
  v_cancelled integer := 0;
  v_failed integer := 0;
  v_error text;
begin
  insert into private.job_runs (job) values ('ride-deadlines') returning id into v_run_id;

  -- Only one run at a time; the lock is released when this transaction ends.
  if not pg_try_advisory_xact_lock(hashtextextended('careride-ride-deadlines', 0)) then
    update private.job_runs set skipped = true, finished_at = clock_timestamp() where id = v_run_id;
    return jsonb_build_object('skipped', true);
  end if;

  for v_ride in
    select r.*
    from public.rides r
    where r.status in ('SEARCHING', 'OFFERED', 'NEEDS_ATTENTION')
      and (
        private.no_driver_deadline(r.type, r.pickup_time) <= v_now
        or r.status in ('SEARCHING', 'OFFERED')
      )
    order by r.pickup_time
    limit p_batch
    for update of r skip locked
  loop
    -- Each ride in its own block: one ride failing is recorded and rolled back without blocking the rest.
    begin
      update public.ride_offers
         set status = 'EXPIRED'
       where ride_id = v_ride.id and status = 'PENDING' and expires_at <= v_now;
      get diagnostics v_expired = row_count;

      if private.no_driver_deadline(v_ride.type, v_ride.pickup_time) <= v_now then
        perform private.close_pending_offers(v_ride.id);
        update public.rides
           set status = 'CANCELLED',
               expired = true,
               cancelled_at = v_now,
               cancel_reason = case when v_ride.type = 'ON_DEMAND'
                                    then 'No driver accepted in time.'
                                    else 'No driver accepted before the pickup time.' end
         where id = v_ride.id;
        v_cancelled := v_cancelled + 1;
      elsif v_ride.status = 'SEARCHING' then
        perform private.dispatch(v_ride.id);
        v_dispatched := v_dispatched + 1;
      else
        if v_expired > 0 then
          perform private.dispatch_if_unanswered(v_ride.id);
          v_dispatched := v_dispatched + 1;
        end if;
        -- Someone approved, back on shift, or newly serving this city since the ride went out
        if private.ask_new_drivers(v_ride.id) > 0 and v_expired = 0 then
          v_dispatched := v_dispatched + 1;
        end if;
      end if;
      v_offers_expired := v_offers_expired + v_expired;
    exception when others then
      v_failed := v_failed + 1;
      v_error := format('ride %s: %s', v_ride.id, sqlerrm);
    end;
  end loop;

  update private.job_runs
     set finished_at = clock_timestamp(),
         offers_expired = v_offers_expired,
         rides_dispatched = v_dispatched,
         rides_cancelled = v_cancelled,
         rides_failed = v_failed,
         error = v_error
   where id = v_run_id;

  -- Keep a week of history.
  delete from private.job_runs where started_at < v_now - interval '7 days';

  return jsonb_build_object(
    'offers_expired', v_offers_expired,
    'rides_dispatched', v_dispatched,
    'rides_cancelled', v_cancelled,
    'rides_failed', v_failed
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A driver who becomes able to drive, or changes when and where, sees open requests straight away
-- ---------------------------------------------------------------------------

create function private.ask_driver_about_open_rides()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ride_id uuid;
begin
  if new.status <> 'APPROVED' or new.deleted_at is not null then
    return null;
  end if;
  if old.status = 'APPROVED'
     and old.request_hours is not distinct from new.request_hours
     and old.service_cities is not distinct from new.service_cities then
    return null;
  end if;

  -- Rides someone is changing right now are left to the per-minute job
  for v_ride_id in
    select r.id from public.rides r
    where r.status in ('SEARCHING', 'OFFERED')
    order by r.pickup_time
    for update skip locked
  loop
    begin
      if (select r.status from public.rides r where r.id = v_ride_id) = 'SEARCHING' then
        perform private.dispatch(v_ride_id);
      else
        perform private.ask_new_drivers(v_ride_id);
      end if;
    exception when others then
      -- Never block an approval or a settings change; the per-minute job tries again
      null;
    end;
  end loop;
  return null;
end;
$$;

create trigger drivers_ask_about_open_rides
  after update of status, request_hours, service_cities on public.drivers
  for each row execute function private.ask_driver_about_open_rides();

revoke execute on function private.ask_new_drivers(uuid) from public;
revoke execute on function private.process_ride_deadlines(integer) from public;
revoke execute on function private.ask_driver_about_open_rides() from public, anon;
grant execute on function private.ask_driver_about_open_rides() to authenticated;
