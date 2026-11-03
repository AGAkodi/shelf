-- Production defaults remain strict. Only the separately installed local adapter creates development rows.
alter table public.payments add column environment text not null default 'production' check (environment in ('production','development'));
alter table public.payments alter column recipient drop not null;
alter table public.payments alter column quote_block_number drop not null;
alter table public.payments drop constraint payments_check6;
alter table public.payments drop constraint payments_check7;
alter table public.payments add constraint payment_environment_evidence check (
 (environment='production' and recipient is not null and quote_block_number is not null)
 or (environment='development' and recipient is null and expected_sender is null and quote_block_number is null
   and tx_hash is null and block_number is null and block_hash is null and block_timestamp is null)
);
alter table public.payments add constraint payment_confirmation_evidence check (
 (status='confirmed' and verified_at is not null and verified_at>=created_at and submitted_at is not null
  and (environment='development' or (tx_hash is not null and expected_sender is not null and block_number is not null
   and block_hash is not null and block_timestamp is not null and verified_at>=block_timestamp)))
 or (status<>'confirmed' and verified_at is null)
);
alter table public.payments add constraint payment_submission_evidence check (
 status not in ('submitted','verifying') or (submitted_at is not null and (environment='development' or (tx_hash is not null and expected_sender is not null)))
);
create function private.protect_payment_environment() returns trigger language plpgsql set search_path='' as $$
begin
 if new.environment is distinct from old.environment then raise exception 'Payment environment is immutable' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.protect_payment_environment() from public,anon,authenticated;
create trigger payment_environment before update on public.payments for each row execute function private.protect_payment_environment();

-- Service-only: callers must verify a user JWT and derive p_user from it.
create function public.library_state(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update public.loans set status='expired' where user_id=p_user and status='active' and expires_at<=clock_timestamp();
 select jsonb_build_object('server_time',clock_timestamp(),
  'loans',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('title',b.title,'author',b.author) order by l.created_at desc)
   from public.loans l join public.books b on b.id=l.book_id where l.user_id=p_user),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('title',b.title) order by p.created_at desc)
   from public.payments p join public.loans l on l.id=p.loan_id join public.books b on b.id=l.book_id where p.user_id=p_user),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.return_loan(p_user uuid,p_loan uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.loans;
begin
 select * into l from public.loans where id=p_loan and user_id=p_user for update;
 if l.id is null then raise exception 'Loan unavailable' using errcode='42501'; end if;
 if l.status='active' then
  if l.expires_at<=clock_timestamp() then update public.loans set status='expired' where id=l.id;
  else update public.loans set status='returned',returned_at=clock_timestamp() where id=l.id; end if;
 elsif l.status not in ('returned','expired') then raise exception 'Loan cannot be returned' using errcode='23514'; end if;
 return public.library_state(p_user);
end $$;
create function public.authorize_chapter(p_user uuid,p_loan uuid,p_book uuid,p_chapter integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.loans; a public.book_assets; version_number integer;
begin
 select * into l from public.loans where id=p_loan and user_id=p_user and book_id=p_book for share;
 if l.id is null or l.status<>'active' or l.expires_at<=clock_timestamp() then
  raise exception 'Reading access denied' using errcode='42501';
 end if;
 select max(version) into version_number from public.book_assets where book_id=p_book;
 select * into a from public.book_assets where book_id=p_book and version=version_number and chapter_number=p_chapter;
 if a.id is null then raise exception 'Chapter unavailable' using errcode='42501'; end if;
 return to_jsonb(a)||jsonb_build_object('expires_at',l.expires_at,'server_time',clock_timestamp(),
 'chapters',(select jsonb_agg(chapter_number order by chapter_number) from public.book_assets where book_id=p_book and version=version_number));
end $$;
revoke all on function public.library_state(uuid),public.return_loan(uuid,uuid),public.authorize_chapter(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.library_state(uuid),public.return_loan(uuid,uuid),public.authorize_chapter(uuid,uuid,uuid,integer) to service_role;

-- Match access checks to the current database clock, including long transactions.
create or replace function private.protect_loan_terms() returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.id, new.user_id, new.book_id, new.borrowing_plan_id, new.duration_days, new.created_at)
    is distinct from row(old.id, old.user_id, old.book_id, old.borrowing_plan_id, old.duration_days, old.created_at)
    or (old.started_at is not null and row(new.started_at, new.expires_at) is distinct from row(old.started_at, old.expires_at))
    or (old.returned_at is not null and new.returned_at is distinct from old.returned_at) then
    raise exception 'Loan terms are immutable' using errcode = '23514';
  end if;
  if new.status <> old.status and not (
    (old.status = 'pending_payment' and new.status in ('active', 'cancelled')) or
    (old.status = 'active' and new.status in ('returned', 'expired'))
  ) then raise exception 'Invalid loan transition' using errcode = '23514'; end if;
  if new.status = 'expired' and new.expires_at > clock_timestamp() then
    raise exception 'Loan has not expired' using errcode = '23514';
  end if;
  return new;
end;
$$;
