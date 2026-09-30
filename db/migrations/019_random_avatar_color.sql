-- 019_random_avatar_color.sql
-- New people get a random avatar colour instead of everyone starting blue.
-- Palette must match AVATAR_COLORS in lib/avatar.ts.

create or replace function random_avatar_color()
returns text language sql volatile as $$
  select (array['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C', '#5DA283', '#6D6E6F'])[floor(random() * 8 + 1)::int]
$$;

alter table profiles alter column avatar_color set default random_avatar_color();

-- The signup trigger that creates profiles lives outside this repo and might
-- write the old '#4573D2' default explicitly, which would bypass the column
-- default. Nobody has picked a colour yet at insert time, so it's safe to
-- replace blue/null here whichever path created the row.
create or replace function profiles_random_avatar_color()
returns trigger language plpgsql as $$
begin
  if NEW.avatar_color is null or NEW.avatar_color = '#4573D2' then
    NEW.avatar_color := random_avatar_color();
  end if;
  return NEW;
end $$;

drop trigger if exists profiles_random_avatar_color_trigger on profiles;
create trigger profiles_random_avatar_color_trigger
  before insert on profiles
  for each row execute function profiles_random_avatar_color();
