-- Run these read-only diagnostics in Supabase SQL Editor to verify the DB is
-- aligned with the TripDriver app and to inspect recursion sources.

-- 1. Verify booking_status enum values required by the app.
select unnest(enum_range(null::public.booking_status))::text as booking_status_value;

-- 2. Verify helper functions exist and execute.
select public.app_expire_stale_bookings() as expired_count;

select
  routine_schema,
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'app_expire_stale_bookings',
    'app_create_booking_with_hold',
    'app_owner_create_car'
  )
order by routine_name;

-- 3. Inspect policies that may recurse between profiles/cars/car_images.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'cars', 'car_images')
order by tablename, policyname;

-- 4. Inspect triggers on the same tables.
select
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('profiles', 'cars', 'car_images')
order by event_object_table, trigger_name;
