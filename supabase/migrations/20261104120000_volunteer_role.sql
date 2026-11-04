-- A general volunteer: someone who takes part in Relay Collective without being a CareRide driver.
--
-- This file only adds the enum value. Postgres can't use a new enum value in the same transaction that
-- added it, so everything that uses VOLUNTEER (constraints, tables, functions) is in the next migration,
-- 20261104120100_general_volunteers.sql. See docs/architecture/volunteers.md.
--
-- Existing roles are untouched: DRIVER keeps meaning "has a CareRide driver profile", and every existing
-- DRIVER account keeps working exactly as before.

alter type public.user_role add value if not exists 'VOLUNTEER';
