
-- 1) Add weekly_goal_hours column to profiles
alter table public.profiles
  add column if not exists weekly_goal_hours integer not null default 40;

-- 2) Guard function to protect updates/inserts on sensitive columns
create or replace function public.profiles_guard_ins_upd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- validate reasonable bounds for weekly_goal_hours
  if new.weekly_goal_hours is not null and (new.weekly_goal_hours < 1 or new.weekly_goal_hours > 80) then
    raise exception 'weekly_goal_hours must be between 1 and 80';
  end if;

  if tg_op = 'INSERT' then
    -- Non-admins cannot set privileged fields on insert
    if not public.is_admin(auth.uid()) then
      new.weekly_goal_hours := coalesce(new.weekly_goal_hours, 40);
      new.role := 'user';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Only admins can change weekly_goal_hours
    if new.weekly_goal_hours is distinct from old.weekly_goal_hours then
      if not public.is_admin(auth.uid()) then
        raise exception 'Only admins can change weekly_goal_hours';
      end if;
    end if;

    -- Only admins can change role
    if new.role is distinct from old.role then
      if not public.is_admin(auth.uid()) then
        raise exception 'Only admins can change role';
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- 3) Attach the guard trigger (insert + update) to profiles
drop trigger if exists profiles_guard_ins_upd on public.profiles;
create trigger profiles_guard_ins_upd
before insert or update on public.profiles
for each row
execute procedure public.profiles_guard_ins_upd();

-- 4) Ensure updated_at is maintained on updates
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.update_updated_at_column();
