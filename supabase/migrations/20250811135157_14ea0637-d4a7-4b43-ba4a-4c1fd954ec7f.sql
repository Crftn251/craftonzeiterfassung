-- Harden functions by setting search_path
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_time_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ended_at is not null and new.ended_at < new.started_at then
    raise exception 'ended_at must be after started_at';
  end if;
  if new.paused_seconds < 0 then
    raise exception 'paused_seconds cannot be negative';
  end if;
  return new;
end;
$$;