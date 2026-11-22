-- Existing titles start with one slot, or enough slots for their current commitments.
alter table public.books add column lending_copies integer not null default 1
  check (lending_copies between 0 and 1000000);
update public.books b set lending_copies=greatest(1,(
  select count(*)::integer from public.loans l where l.book_id=b.id
  and (l.status='pending_payment' or (l.status='active' and l.expires_at>clock_timestamp()))
));
alter table public.books add column archive_identifier text unique
  check (archive_identifier ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$');
alter table public.books add column source_license text;

create function private.enforce_lending_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare capacity integer; occupied integer;
begin
  if new.status not in ('pending_payment','active') then return new; end if;
  if tg_op='UPDATE' and old.status='pending_payment' then return new; end if;
  if tg_op='UPDATE' and old.status='active' then return new; end if;
  select lending_copies into capacity from public.books where id=new.book_id for update;
  select count(*) into occupied from public.loans where book_id=new.book_id
    and (status='pending_payment' or (status='active' and expires_at>clock_timestamp()));
  if occupied>=capacity then raise exception 'All lending copies are reserved or borrowed' using errcode='P0001'; end if;
  return new;
end $$;
revoke all on function private.enforce_lending_capacity() from public,anon,authenticated;
create trigger lending_capacity before insert or update of status on public.loans
for each row execute function private.enforce_lending_capacity();

create function private.check_lending_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.lending_copies < (select count(*) from public.loans where book_id=new.id
    and (status='pending_payment' or (status='active' and expires_at>clock_timestamp()))) then
    raise exception 'The copy limit must cover existing reservations and active loans' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.check_lending_limit() from public,anon,authenticated;
create trigger lending_limit before update of lending_copies on public.books
for each row execute function private.check_lending_limit();

create table public.book_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id),
  stars smallint not null check(stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,book_id)
);
alter table public.book_ratings enable row level security;
grant select on public.book_ratings to authenticated;
grant insert(user_id,book_id,stars),update(stars) on public.book_ratings to authenticated;
create policy rating_read on public.book_ratings for select to authenticated using(user_id=(select auth.uid()));
create policy rating_insert on public.book_ratings for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(
 select 1 from public.loans l join public.payments p on p.loan_id=l.id
 where l.book_id=book_ratings.book_id and l.user_id=(select auth.uid()) and l.started_at is not null
 and l.status in ('active','returned','expired') and p.status='confirmed' and p.environment='production' and p.verified_at is not null
 ));
create policy rating_update on public.book_ratings for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and exists(
 select 1 from public.loans l join public.payments p on p.loan_id=l.id
 where l.book_id=book_ratings.book_id and l.user_id=(select auth.uid()) and l.started_at is not null
 and l.status in ('active','returned','expired') and p.status='confirmed' and p.environment='production' and p.verified_at is not null
 ));
create trigger touch_updated_at before update on public.book_ratings for each row execute function private.touch_updated_at();

create function public.book_statistics(p_books uuid[]) returns table(
 book_id uuid, copies integer, available integer, borrowed integer, reserved integer,
 times_borrowed bigint, rating_count bigint, average_rating numeric)
language sql stable security definer set search_path='' as $$
 select b.id,b.lending_copies,
 greatest(0,b.lending_copies-coalesce(l.active,0)-coalesce(l.pending,0)),
 coalesce(l.active,0),coalesce(l.pending,0),coalesce(p.total,0),coalesce(r.total,0),r.average
 from public.books b
 left join lateral (select
   count(*) filter(where status='active' and expires_at>statement_timestamp())::integer active,
   count(*) filter(where status='pending_payment')::integer pending
   from public.loans where book_id=b.id) l on true
 left join lateral (select count(*) total from public.payments p join public.loans l on l.id=p.loan_id
   where l.book_id=b.id and p.status='confirmed' and p.environment='production') p on true
 left join lateral (select count(*) total,round(avg(stars),1) average from public.book_ratings where book_id=b.id) r on true
 where b.id=any(p_books) and cardinality(p_books)<=100
 and (b.status='published' or private.is_admin());
$$;
revoke all on function public.book_statistics(uuid[]) from public;
grant execute on function public.book_statistics(uuid[]) to anon,authenticated;

-- Serialize quote creation per title before counting available copies.
create or replace function public.payment_checkout(p_user uuid,p_session uuid,p_book uuid,p_plan uuid,p_key uuid,p_recipient text,p_block bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w jsonb; b public.books; plan public.borrowing_plans; l public.loans; p public.payments; share bigint;
begin
 perform 1 from auth.users where id=p_user for update;
 w:=public.wallet_status(p_user,p_session);
 if not (w->>'session_verified')::boolean then raise exception 'Verify wallet first' using errcode='42501'; end if;
 select * into p from public.payments where user_id=p_user and idempotency_key=p_key;
 if p.id is not null then
  select * into l from public.loans where id=p.loan_id;
  if l.book_id<>p_book or l.borrowing_plan_id<>p_plan or p.environment<>'production' then raise exception 'Quote conflict' using errcode='23514'; end if;
  return public.payment_state(p_user,p.id);
 end if;
 update public.loans set status='expired' where user_id=p_user and status='active' and expires_at<=clock_timestamp();
 select * into l from public.loans where user_id=p_user and book_id=p_book and status in ('pending_payment','active');
 if l.id is not null then
  if l.status='pending_payment' and l.borrowing_plan_id=p_plan then
   select * into p from public.payments where loan_id=l.id and environment='production' and status in ('pending','submitted','verifying');
   if p.id is not null then return public.payment_state(p_user,p.id); end if;
  end if;
  raise exception 'Existing loan or checkout' using errcode='23514';
 end if;
 if (select count(*) from public.payments where user_id=p_user and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'Checkout rate limit' using errcode='P0001'; end if;
 select * into b from public.books where id=p_book and status='published' for update;
 select * into plan from public.borrowing_plans where id=p_plan and book_id=p_book and enabled for share;
 if b.id is null or plan.id is null then raise exception 'Plan unavailable' using errcode='23514'; end if;
 if not exists(select 1 from public.book_licenses where book_id=b.id and distribution_permitted and reviewed_at is not null and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()))
 or not exists(select 1 from public.book_assets where book_id=b.id) then raise exception 'Content unavailable' using errcode='23514'; end if;
 insert into public.loans(user_id,book_id,borrowing_plan_id,duration_days) values(p_user,b.id,plan.id,plan.duration_days) returning * into l;
 share:=case when b.ownership='contributor' then floor(plan.price_units::numeric*4/5)::bigint else 0 end;
 insert into public.payments(loan_id,user_id,gross_amount,ownership,contributor_id,contributor_share,platform_share,recipient,expected_sender,quote_block_number,idempotency_key)
 values(l.id,p_user,plan.price_units,b.ownership,b.contributor_id,share,plan.price_units-share,p_recipient,w->>'address',p_block,p_key) returning * into p;
 insert into private.payment_dispatch(payment_id) values(p.id);
 return public.payment_state(p_user,p.id);
end $$;
