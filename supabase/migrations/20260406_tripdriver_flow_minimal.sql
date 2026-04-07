-- Minimal migration for the React/Supabase TripDriver flow.
-- Synced from the Flutter source of truth and kept intentionally small.
-- Why this is needed:
-- 1. bookings.hold_expires_at is required for the one-hour hold rule.
-- 2. payments.submitted_at is required so admin can see when renter pressed
--    "I have paid".
-- 3. Additional enum values are required to match the business flow that the
--    React app now uses.
-- 4. The helper functions below keep hold creation/expiration in the database
--    source of truth instead of local UI state.

alter table public.bookings
  add column if not exists hold_expires_at timestamp with time zone;

alter table public.payments
  add column if not exists submitted_at timestamp with time zone;

do $$
begin
  alter type public.car_status add value if not exists 'ACTIVE';
  alter type public.car_status add value if not exists 'HELD';
  alter type public.car_status add value if not exists 'RENTED';
  alter type public.car_status add value if not exists 'DEACTIVE';
exception
  when undefined_object then
    null;
end $$;

do $$
begin
  alter type public.booking_status add value if not exists 'PENDING_ADMIN_PAYMENT_REVIEW';
  alter type public.booking_status add value if not exists 'PENDING_OWNER_CONFIRMATION';
  alter type public.booking_status add value if not exists 'CONFIRMED';
  alter type public.booking_status add value if not exists 'IN_PROGRESS';
  alter type public.booking_status add value if not exists 'COMPLETED';
  alter type public.booking_status add value if not exists 'REJECTED_BY_OWNER';
  alter type public.booking_status add value if not exists 'CANCELLED';
  alter type public.booking_status add value if not exists 'EXPIRED';
exception
  when undefined_object then
    null;
end $$;

do $$
begin
  alter type public.payment_status add value if not exists 'PAID';
  alter type public.payment_status add value if not exists 'FAILED';
  alter type public.payment_status add value if not exists 'REFUNDED';
exception
  when undefined_object then
    null;
end $$;

do $$
begin
  alter type public.notification_type add value if not exists 'INFO';
  alter type public.notification_type add value if not exists 'SUCCESS';
  alter type public.notification_type add value if not exists 'WARNING';
exception
  when undefined_object then
    null;
end $$;

do $$
begin
  alter type public.payment_type add value if not exists 'DEPOSIT';
exception
  when undefined_object then
    null;
end $$;

create or replace function public.app_expire_stale_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_booking record;
  affected_count integer := 0;
begin
  for stale_booking in
    select b.id, b.car_id, b.customer_id, b.owner_id, b.status
    from public.bookings b
    where b.status in ('PENDING_DEPOSIT', 'PENDING_ADMIN_PAYMENT_REVIEW')
      and b.hold_expires_at is not null
      and b.hold_expires_at <= now()
  loop
    update public.bookings
    set status = 'EXPIRED',
        updated_at = now()
    where id = stale_booking.id
      and status in ('PENDING_DEPOSIT', 'PENDING_ADMIN_PAYMENT_REVIEW');

    if found then
      affected_count := affected_count + 1;

      update public.payments
      set status = case when status = 'PENDING' then 'FAILED' else status end,
          updated_at = now()
      where booking_id = stale_booking.id;

      insert into public.booking_status_history (
        booking_id,
        from_status,
        to_status,
        changed_by,
        note
      )
      values (
        stale_booking.id,
        stale_booking.status,
        'EXPIRED',
        null,
        'Booking expired because the one-hour hold elapsed before deposit resolution.'
      );

      if not exists (
        select 1
        from public.bookings b
        where b.car_id = stale_booking.car_id
          and b.status in (
            'PENDING_DEPOSIT',
            'PENDING_ADMIN_PAYMENT_REVIEW',
            'PENDING_OWNER_CONFIRMATION',
            'CONFIRMED',
            'IN_PROGRESS'
          )
      ) then
        update public.cars
        set status = 'ACTIVE',
            updated_at = now()
        where id = stale_booking.car_id;
      end if;
    end if;
  end loop;

  return affected_count;
end;
$$;

create or replace function public.app_create_booking_with_hold(
  p_car_id uuid,
  p_start_date date,
  p_end_date date,
  p_pickup_note text default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_car record;
  v_booking_id uuid;
  v_payment_id uuid;
  v_booking_code text;
  v_days integer;
  v_total_amount numeric;
  v_deposit_amount numeric;
  v_remaining_amount numeric;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select role
  into v_actor_role
  from public.profiles
  where id = v_actor_id;

  if v_actor_role is distinct from 'RENTER' then
    raise exception 'Only renters can create bookings.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be after or equal to start date.';
  end if;

  perform public.app_expire_stale_bookings();

  select c.*
  into v_car
  from public.cars c
  where c.id = p_car_id
  for update;

  if not found then
    raise exception 'Car not found.';
  end if;

  if v_car.status <> 'ACTIVE' then
    raise exception 'This car is not currently available.';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.car_id = p_car_id
      and b.status in (
        'PENDING_DEPOSIT',
        'PENDING_ADMIN_PAYMENT_REVIEW',
        'PENDING_OWNER_CONFIRMATION',
        'CONFIRMED',
        'IN_PROGRESS'
      )
      and daterange(b.start_date, b.end_date, '[]')
        && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'This car already has an active hold or booking in the selected time range.';
  end if;

  v_days := greatest(1, p_end_date - p_start_date);
  v_total_amount := v_car.price_per_day * v_days;
  v_deposit_amount := round(v_total_amount * (coalesce(v_car.deposit_percent, 20) / 100.0));
  v_remaining_amount := v_total_amount - v_deposit_amount;
  v_booking_code := 'TD-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  insert into public.bookings (
    booking_code,
    car_id,
    owner_id,
    customer_id,
    start_date,
    end_date,
    pickup_note,
    customer_note,
    status,
    total_amount,
    deposit_amount,
    remaining_amount,
    platform_fee_amount,
    owner_payout_amount,
    currency,
    hold_expires_at
  )
  values (
    v_booking_code,
    p_car_id,
    v_car.owner_id,
    v_actor_id,
    p_start_date,
    p_end_date,
    nullif(trim(coalesce(p_pickup_note, '')), ''),
    nullif(trim(coalesce(p_customer_note, '')), ''),
    'PENDING_DEPOSIT',
    v_total_amount,
    v_deposit_amount,
    v_remaining_amount,
    v_deposit_amount,
    v_remaining_amount,
    'VND',
    now() + interval '1 hour'
  )
  returning id into v_booking_id;

  insert into public.payments (
    booking_id,
    type,
    status,
    method,
    amount,
    currency
  )
  values (
    v_booking_id,
    'DEPOSIT',
    'PENDING',
    'BANK_TRANSFER',
    v_deposit_amount,
    'VND'
  )
  returning id into v_payment_id;

  update public.cars
  set status = 'HELD',
      updated_at = now()
  where id = p_car_id;

  insert into public.booking_status_history (
    booking_id,
    from_status,
    to_status,
    changed_by,
    note
  )
  values (
    v_booking_id,
    null,
    'PENDING_DEPOSIT',
    v_actor_id,
    'Booking created and car held for one hour.'
  );

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'booking_code', v_booking_code
  );
end;
$$;

grant execute on function public.app_expire_stale_bookings() to authenticated;
grant execute on function public.app_create_booking_with_hold(uuid, date, date, text, text) to authenticated;
