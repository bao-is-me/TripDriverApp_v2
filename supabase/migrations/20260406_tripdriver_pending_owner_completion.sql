-- Add an explicit booking status for the handoff step:
-- renter has returned the car, but the owner still needs to confirm trip completion.
-- This keeps the flow reliable without relying on booking_status_history notes.

do $$
begin
  alter type public.booking_status add value if not exists 'PENDING_OWNER_COMPLETION';
exception
  when undefined_object then
    null;
end $$;

create or replace function public.app_reconcile_car_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  update public.cars c
  set status = (
        case
          when exists (
            select 1
            from public.bookings b
            where b.car_id = c.id
              and b.status in ('IN_PROGRESS', 'PENDING_OWNER_COMPLETION')
          ) then 'RENTED'::public.car_status
          when exists (
            select 1
            from public.bookings b
            where b.car_id = c.id
              and b.status in (
                'PENDING_DEPOSIT',
                'PENDING_ADMIN_PAYMENT_REVIEW',
                'PENDING_OWNER_CONFIRMATION',
                'CONFIRMED'
              )
          ) then 'HELD'::public.car_status
          when c.status in ('HELD', 'RENTED') then 'ACTIVE'::public.car_status
          else c.status
        end
      ),
      updated_at = now()
  where c.status is distinct from (
        case
          when exists (
            select 1
            from public.bookings b
            where b.car_id = c.id
              and b.status in ('IN_PROGRESS', 'PENDING_OWNER_COMPLETION')
          ) then 'RENTED'::public.car_status
          when exists (
            select 1
            from public.bookings b
            where b.car_id = c.id
              and b.status in (
                'PENDING_DEPOSIT',
                'PENDING_ADMIN_PAYMENT_REVIEW',
                'PENDING_OWNER_CONFIRMATION',
                'CONFIRMED'
              )
          ) then 'HELD'::public.car_status
          when c.status in ('HELD', 'RENTED') then 'ACTIVE'::public.car_status
          else c.status
        end
      );

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.app_reconcile_car_statuses() to authenticated;
