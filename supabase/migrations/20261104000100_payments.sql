-- Production payment transitions. All RPCs are service-only; JWT identity is supplied by the Edge handler.
create table private.payment_dispatch (
 payment_id uuid primary key references public.payments(id),
 prompted boolean not null default false,
 candidate_hash text check(candidate_hash ~ '^0x[0-9a-f]{64}$'),
 checked_at timestamptz,
 attempts integer not null default 0,
 window_started_at timestamptz not null default clock_timestamp()
);
alter table private.payment_dispatch enable row level security;
revoke all on private.payment_dispatch from public,anon,authenticated;

create function public.payment_state(p_user uuid,p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments; d private.payment_dispatch;
begin
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production';
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 select * into d from private.payment_dispatch where payment_id=p.id;
 return jsonb_build_object('payment',to_jsonb(p)||jsonb_build_object('gross_amount',p.gross_amount::text,'quote_block_number',p.quote_block_number::text),
 'loan',(select to_jsonb(l) from public.loans l where id=p.loan_id),'prompted',coalesce(d.prompted,false),'candidate_hash',d.candidate_hash);
end $$;

create function public.payment_checkout(p_user uuid,p_session uuid,p_book uuid,p_plan uuid,p_key uuid,p_recipient text,p_block bigint)
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
 select * into b from public.books where id=p_book and status='published' for share;
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

create function public.payment_dispatch(p_user uuid,p_session uuid,p_payment uuid,p_action text,p_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments; d private.payment_dispatch; w jsonb;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production' for update;
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 select * into d from private.payment_dispatch where payment_id=p.id for update;
 if p.status='confirmed' then return public.payment_state(p_user,p.id); end if;
 if p.status<>'pending' then raise exception 'Payment closed' using errcode='23514'; end if;
 if p_action='claim' then
  w:=public.wallet_status(p_user,p_session);
  if not (w->>'session_verified')::boolean or w->>'address'<>p.expected_sender then raise exception 'Verify matching wallet' using errcode='42501'; end if;
  if d.prompted or d.candidate_hash is not null then raise exception 'Payment already requested; reconcile first' using errcode='23514'; end if;
  update private.payment_dispatch set prompted=true where payment_id=p.id;
 elsif p_action='rejected' then
  -- Only the explicit wallet rejection UI uses this. Never used after an ambiguous outcome.
  if d.candidate_hash is not null then raise exception 'Payment may be submitted' using errcode='23514'; end if;
  update private.payment_dispatch set prompted=false where payment_id=p.id;
 elsif p_action='candidate' then
  if p_hash is null or p_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'Invalid hash' using errcode='23514'; end if;
  update private.payment_dispatch set candidate_hash=p_hash,prompted=true where payment_id=p.id;
 elsif p_action='check' then
  if d.checked_at>clock_timestamp()-interval '4 seconds' or (d.window_started_at>clock_timestamp()-interval '1 hour' and d.attempts>=120) then raise exception 'Verification rate limit' using errcode='P0001'; end if;
  update private.payment_dispatch set checked_at=clock_timestamp(),attempts=case when window_started_at<clock_timestamp()-interval '1 hour' then 1 else attempts+1 end,
  window_started_at=case when window_started_at<clock_timestamp()-interval '1 hour' then clock_timestamp() else window_started_at end where payment_id=p.id;
 elsif p_action='cancel' then
  if d.prompted or d.candidate_hash is not null then raise exception 'Reconcile submitted payment first' using errcode='23514'; end if;
  update public.payments set status='cancelled' where id=p.id;
  update public.loans set status='cancelled' where id=p.loan_id;
 else raise exception 'Unknown action' using errcode='23514'; end if;
 return public.payment_state(p_user,p.id);
end $$;

create function public.payment_finalize(p_user uuid,p_payment uuid,p_hash text,p_block bigint,p_block_hash text,p_block_time timestamptz,p_finalized bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments; l public.loans; activated timestamptz;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production' for update;
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 if p.status='confirmed' and p.tx_hash=p_hash then return public.payment_state(p_user,p.id); end if;
 select * into l from public.loans where id=p.loan_id for update;
 if p.status<>'pending' or l.status<>'pending_payment' or p_block<=p.quote_block_number or p_block>p_finalized or p_block_time<p.created_at or p_block_time>clock_timestamp() then raise exception 'Ineligible payment' using errcode='23514'; end if;
 activated:=clock_timestamp();
 -- The unique chain/hash index atomically rejects replay across users and orders.
 update public.payments set status='submitted',tx_hash=p_hash,submitted_at=activated where id=p.id;
 update public.payments set status='verifying',last_checked_at=activated where id=p.id;
 update public.payments set status='confirmed',block_number=p_block,block_hash=p_block_hash,block_timestamp=p_block_time,verified_at=activated where id=p.id;
 update public.loans set status='active',started_at=activated,expires_at=activated+l.duration_days*interval '24 hours' where id=l.id;
 return public.payment_state(p_user,p.id);
end $$;
revoke all on function public.payment_state(uuid,uuid),public.payment_checkout(uuid,uuid,uuid,uuid,uuid,text,bigint),public.payment_dispatch(uuid,uuid,uuid,text,text),public.payment_finalize(uuid,uuid,text,bigint,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.payment_state(uuid,uuid),public.payment_checkout(uuid,uuid,uuid,uuid,uuid,text,bigint),public.payment_dispatch(uuid,uuid,uuid,text,text),public.payment_finalize(uuid,uuid,text,bigint,text,timestamptz,bigint) to service_role;
