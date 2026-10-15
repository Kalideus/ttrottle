-- 042_contact_tags.sql
-- Contacts get free tags, as many as you like, in place of services and the fixed department list.
-- Each contact keeps its services and its department names, as tags. Run after 041. Safe to re-run.

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'services') then
    alter table contacts rename column services to tags;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'department_ids') then
    -- a department name becomes a tag without any emoji in front ("📈 Marketing" -> "Marketing"), unless it's already one
    update contacts c set tags = c.tags || array(
      select regexp_replace(d.name, '^\W+', '')
      from departments d
      where d.id = any(c.department_ids)
        and lower(regexp_replace(d.name, '^\W+', '')) <> all(select lower(t) from unnest(c.tags) t)
      order by d.position
    )
    where c.department_ids <> '{}';
    alter table contacts drop column department_ids;
  end if;
end $$;

drop table if exists departments;
