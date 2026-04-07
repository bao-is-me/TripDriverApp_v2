create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.bookings b
      where b.customer_id = auth.uid()
        and b.owner_id = target_profile_id
        and b.status in (
          'CONFIRMED',
          'IN_PROGRESS',
          'PENDING_OWNER_COMPLETION',
          'COMPLETED'
        )
    )
    or exists (
      select 1
      from public.bookings b
      where b.owner_id = auth.uid()
        and b.customer_id = target_profile_id
        and b.status in (
          'PENDING_OWNER_CONFIRMATION',
          'CONFIRMED',
          'IN_PROGRESS',
          'PENDING_OWNER_COMPLETION',
          'COMPLETED',
          'REJECTED_BY_OWNER'
        )
    );
$$;

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated, anon;

drop policy if exists profiles_select_own_or_admin on public.profiles;

create policy profiles_select_visible_profiles
on public.profiles
for select
to public
using (public.can_view_profile(id));
