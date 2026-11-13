-- Run in the Relay Collective Supabase SQL Editor after the existing migrations.
-- No secrets or outbound network access are needed for the inbox. See docs/PWA_NOTIFICATIONS.md for push.
begin;

create table public.careride_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  offers boolean not null default true,
  updates boolean not null default true
);

create table public.careride_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  offer_id uuid references public.ride_offers(id) on delete set null,
  kind text not null check (kind in (
    'OFFER', 'REQUESTED', 'EDITED', 'SENT_AGAIN', 'NO_DRIVER_AVAILABLE', 'DRIVER_ACCEPTED',
    'DRIVER_DROPPED', 'DRIVER_REMOVED', 'ON_THE_WAY', 'ARRIVED', 'PICKED_UP',
    'COMPLETED', 'NO_SHOW', 'CANCELLED', 'STEP_UNDONE'
  )),
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  unique (profile_id, offer_id)
);
create index careride_notifications_inbox_idx on public.careride_notifications (profile_id, created_at desc, id desc);
create index careride_notifications_unread_idx on public.careride_notifications (profile_id) where read_at is null;

-- Endpoints and encryption keys are server-only; the client checks device registration through RPC.
create table private.careride_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
alter table private.careride_push_subscriptions enable row level security;
revoke all on private.careride_push_subscriptions from public, anon, authenticated;
create index careride_push_subscriptions_profile_idx on private.careride_push_subscriptions(profile_id);

create table private.careride_push_deliveries (
  notification_id uuid not null references public.careride_notifications(id) on delete cascade,
  subscription_id uuid not null references private.careride_push_subscriptions(id) on delete cascade,
  attempts int not null default 0,
  next_at timestamptz not null default now(),
  lease uuid,
  done boolean not null default false,
  primary key (notification_id, subscription_id)
);
alter table private.careride_push_deliveries enable row level security;
revoke all on private.careride_push_deliveries from public, anon, authenticated;
create index careride_push_pending_idx on private.careride_push_deliveries(next_at) where not done;

alter table public.careride_notifications enable row level security;
alter table public.careride_notification_preferences enable row level security;
revoke all on public.careride_notifications, public.careride_notification_preferences from public, anon, authenticated;
grant select on public.careride_notifications, public.careride_notification_preferences to authenticated;
create policy careride_notifications_own on public.careride_notifications for select to authenticated
  using (profile_id = (select private.my_profile_id()));
create policy careride_preferences_own on public.careride_notification_preferences for select to authenticated
  using (profile_id = (select private.my_profile_id()));

create function public.careride_mark_notifications_read(p_id uuid default null)
returns void language sql security definer set search_path = '' as $$
  update public.careride_notifications set read_at = now()
  where profile_id = (select private.my_profile_id()) and read_at is null and (p_id is null or id = p_id);
$$;

create function public.careride_save_notification_preferences(p_offers boolean, p_updates boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.careride_notification_preferences (profile_id, offers, updates)
  select p.id, p_offers, p_updates from public.profiles p
  where p.id = (select private.my_profile_id()) and p.role in ('DRIVER', 'PARTNER', 'ORG_ADMIN')
  on conflict (profile_id) do update set offers = excluded.offers, updates = excluded.updates;
$$;

-- Allow only the browser push services Relay supports. Exact host, HTTPS, no credentials, ports,
-- redirects or private hosts. The sender repeats this validation before making an outbound request.
create function public.careride_register_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid := private.my_profile_id();
begin
  if v_profile is null or coalesce(private.my_role() not in ('DRIVER', 'PARTNER', 'ORG_ADMIN'), true) then
    raise exception 'Sign in with a CareRide account.';
  end if;
  if p_endpoint is null or length(p_endpoint) > 2048
    or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[A-Za-z0-9_/.~%?&=:+-]+$'
    or p_p256dh is null or p_p256dh !~ '^B[A-Za-z0-9_-]{86}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'This browser did not provide a supported push subscription.';
  end if;
  -- A browser can be shared. Drop the old registration (and its queued alerts) on account changes.
  delete from private.careride_push_subscriptions where endpoint = p_endpoint and profile_id <> v_profile;
  insert into private.careride_push_subscriptions (profile_id, endpoint, p256dh, auth_key)
  values (v_profile, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_key = excluded.auth_key
    where private.careride_push_subscriptions.profile_id = v_profile;
  if not found then raise exception 'Please try enabling alerts again.'; end if;
end;
$$;

create function public.careride_has_push(p_endpoint text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.careride_push_subscriptions
    where profile_id = (select private.my_profile_id()) and endpoint = p_endpoint);
$$;

create function public.careride_remove_push(p_endpoint text default null)
returns void language sql security definer set search_path = '' as $$
  delete from private.careride_push_subscriptions
    where profile_id = (select private.my_profile_id()) and (p_endpoint is null or endpoint = p_endpoint);
$$;

revoke execute on function public.careride_mark_notifications_read(uuid),
  public.careride_save_notification_preferences(boolean, boolean),
  public.careride_register_push(text, text, text), public.careride_has_push(text), public.careride_remove_push(text)
from public, anon, authenticated;
grant execute on function public.careride_mark_notifications_read(uuid),
  public.careride_save_notification_preferences(boolean, boolean),
  public.careride_register_push(text, text, text), public.careride_has_push(text), public.careride_remove_push(text)
to authenticated;

create function private.careride_queue_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.careride_push_deliveries (notification_id, subscription_id)
  select new.id, s.id
  from private.careride_push_subscriptions s
  left join public.careride_notification_preferences pref on pref.profile_id = s.profile_id
  where s.profile_id = new.profile_id
    and coalesce(case when new.kind = 'OFFER' then pref.offers else pref.updates end, true);
  return null;
end;
$$;
create trigger careride_queue_push after insert on public.careride_notifications
  for each row execute function private.careride_queue_push();

-- An offer is Relay's source of truth for eligibility. This includes new matches
-- sent by the deadline and availability jobs, without a second dispatch algorithm.
create function private.careride_notify_offer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'PENDING' then return null; end if;
  insert into public.careride_notifications (profile_id, ride_id, offer_id, kind)
  select p.id, new.ride_id, new.id, 'OFFER'
  from public.drivers d join public.profiles p
    on p.id = d.profile_id or (d.org_id = p.org_id and p.role = 'ORG_ADMIN')
  where d.id = new.driver_id and p.is_active and p.auth_user_id is not null
    and p.role in ('DRIVER', 'ORG_ADMIN')
  on conflict (profile_id, offer_id) do nothing;
  return null;
end;
$$;
create trigger careride_notify_offer after insert on public.ride_offers
  for each row execute function private.careride_notify_offer();

-- Reuse the audited ride changes. Skip the actor and omit all rider information.
create function private.careride_notify_ride_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.careride_notifications (profile_id, ride_id, kind)
  select p.id, r.id, new.kind::text
  from public.rides r
  left join public.drivers d on d.id = r.driver_id
  left join public.drivers reconfirm on reconfirm.id = r.reconfirm_driver_id
  join public.profiles p on (p.role = 'PARTNER' and p.org_id = r.org_id)
    or (p.role = 'ORG_ADMIN' and p.org_id = d.org_id)
    or (p.role = 'DRIVER' and (p.id = d.profile_id or (new.kind = 'EDITED' and p.id = reconfirm.profile_id)))
  where r.id = new.ride_id and p.is_active and p.auth_user_id is not null
    and p.id is distinct from new.actor_profile_id
    and (p.role <> 'DRIVER' or new.kind in ('DRIVER_ACCEPTED', 'EDITED', 'CANCELLED', 'DRIVER_REMOVED', 'STEP_UNDONE'));
  return null;
end;
$$;
create trigger careride_notify_ride_event after insert on public.ride_events
  for each row execute function private.careride_notify_ride_event();

-- Lease pending deliveries before doing network work. Skip expired/taken offers, read inbox items
-- and opted-out or inactive accounts. A limited lifetime prevents old alerts after an outage.
create function public.careride_claim_push()
returns table (notification_id uuid, subscription_id uuid, endpoint text, p256dh text, auth_key text, lease uuid)
language sql security definer set search_path = '' as $$
  with claimable as (
    select q.notification_id, q.subscription_id
    from private.careride_push_deliveries q
    join public.careride_notifications n on n.id = q.notification_id
    join private.careride_push_subscriptions s on s.id = q.subscription_id and s.profile_id = n.profile_id
    join public.profiles p on p.id = s.profile_id
    left join public.ride_offers o on o.id = n.offer_id
    left join public.careride_notification_preferences pref on pref.profile_id = n.profile_id
    where not q.done and q.next_at <= now() and q.attempts < 4
      and n.created_at > now() - interval '1 hour' and n.read_at is null
      and p.is_active and p.auth_user_id is not null
      and coalesce(case when n.kind = 'OFFER' then pref.offers else pref.updates end, true)
      and (n.kind <> 'OFFER' or (o.status = 'PENDING' and o.expires_at > now()))
    order by q.next_at
    limit 40 for update of q skip locked
  ), leased as (
    update private.careride_push_deliveries q
    set attempts = q.attempts + 1, next_at = now() + interval '2 minutes', lease = gen_random_uuid()
    from claimable c
    where q.notification_id = c.notification_id and q.subscription_id = c.subscription_id
    returning q.notification_id, q.subscription_id, q.lease
  )
  select l.notification_id, l.subscription_id, s.endpoint, s.p256dh, s.auth_key, l.lease
  from leased l join private.careride_push_subscriptions s on s.id = l.subscription_id;
$$;

create function public.careride_finish_push(p_notification uuid, p_subscription uuid, p_lease uuid, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_result = 'gone' then
    delete from private.careride_push_subscriptions s where s.id = p_subscription
      and exists (select 1 from private.careride_push_deliveries q
        where q.notification_id = p_notification and q.subscription_id = s.id and q.lease = p_lease);
  else
    update private.careride_push_deliveries
      set done = p_result in ('sent', 'failed'), lease = null
      where notification_id = p_notification and subscription_id = p_subscription and lease = p_lease;
  end if;
end;
$$;

create function public.careride_prune_push()
returns void language sql security definer set search_path = '' as $$
  delete from private.careride_push_deliveries q using public.careride_notifications n
    where q.notification_id = n.id and (q.done or n.created_at <= now() - interval '1 hour');
$$;

revoke execute on function private.careride_queue_push(), private.careride_notify_offer(), private.careride_notify_ride_event() from public, anon, authenticated;
revoke execute on function public.careride_claim_push(), public.careride_finish_push(uuid, uuid, uuid, text), public.careride_prune_push() from public, anon, authenticated;
grant execute on function public.careride_claim_push(), public.careride_finish_push(uuid, uuid, uuid, text), public.careride_prune_push() to service_role;

alter publication supabase_realtime add table public.careride_notifications;
commit;
