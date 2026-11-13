-- OPTIONAL: run after the inbox migration, the Edge Function deployment and the two Vault
-- entries in docs/PWA_NOTIFICATIONS.md. This script contains no credentials.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'careride_push_function_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'careride_push_job_token') then
    raise exception 'Add the two CareRide push secrets to Vault first. See docs/PWA_NOTIFICATIONS.md.';
  end if;
end;
$$;

select cron.schedule('careride-web-push', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'careride_push_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-careride-job-token', (select decrypted_secret from vault.decrypted_secrets where name = 'careride_push_job_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 65000
  );
$job$);
