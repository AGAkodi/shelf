create function private.apply_application_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' or new.status not in ('approved','rejected') then
    raise exception 'Application already reviewed or invalid decision';
  end if;
  new.reviewed_by := auth.uid();
  new.reviewed_at := clock_timestamp();
  if new.status = 'approved' then
    insert into public.contributors(user_id,application_id,name,contact,contributor_type)
    values(new.user_id,new.id,new.name,new.contact,new.contributor_type)
    on conflict (user_id) do update set application_id=excluded.application_id,
      name=excluded.name, contact=excluded.contact, contributor_type=excluded.contributor_type;
  end if;
  return new;
end $$;
revoke all on function private.apply_application_review() from public, anon, authenticated;
create trigger apply_application_review before update of status on public.contributor_applications
for each row execute function private.apply_application_review();
