create or replace function public.can_view_car(target_car_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.cars c
      where c.id = target_car_id
        and c.owner_id = auth.uid()
    )
    or public.is_admin()
    or exists (
      select 1
      from public.bookings b
      where b.customer_id = auth.uid()
        and b.car_id = target_car_id
    );
$$;

revoke all on function public.can_view_car(uuid) from public;
grant execute on function public.can_view_car(uuid) to authenticated;

drop policy if exists cars_authenticated_history_select on public.cars;

create policy cars_authenticated_history_select
on public.cars
for select
to authenticated
using (public.can_view_car(id));
