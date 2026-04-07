-- Hotfix for app_owner_create_car type mismatch:
-- cars.status is public.car_status, so the CASE expression must be cast.

create or replace function public.app_owner_create_car(
  p_brand text,
  p_model text,
  p_year integer,
  p_transmission text,
  p_fuel text,
  p_seats integer,
  p_location text,
  p_price_per_day numeric,
  p_description text default null,
  p_active_now boolean default true,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_car_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select role
  into v_actor_role
  from public.profiles
  where id = v_actor_id;

  if v_actor_role is distinct from 'OWNER' then
    raise exception 'Only owners can create cars.';
  end if;

  insert into public.cars (
    owner_id,
    brand,
    model,
    year,
    transmission,
    fuel,
    seats,
    location,
    price_per_day,
    deposit_percent,
    description,
    status
  )
  values (
    v_actor_id,
    trim(coalesce(p_brand, '')),
    trim(coalesce(p_model, '')),
    greatest(coalesce(p_year, 0), 0),
    trim(coalesce(p_transmission, '')),
    trim(coalesce(p_fuel, '')),
    greatest(coalesce(p_seats, 0), 0),
    trim(coalesce(p_location, '')),
    greatest(coalesce(p_price_per_day, 0), 0),
    20,
    trim(coalesce(p_description, '')),
    (
      case
        when coalesce(p_active_now, true) then 'ACTIVE'
        else 'DEACTIVE'
      end
    )::public.car_status
  )
  returning id into v_car_id;

  if nullif(trim(coalesce(p_image_url, '')), '') is not null then
    insert into public.car_images (
      car_id,
      image_url,
      sort_order
    )
    values (
      v_car_id,
      trim(p_image_url),
      0
    );
  end if;

  return jsonb_build_object('car_id', v_car_id);
end;
$$;

grant execute on function public.app_owner_create_car(
  text,
  text,
  integer,
  text,
  text,
  integer,
  text,
  numeric,
  text,
  boolean,
  text
) to authenticated;
