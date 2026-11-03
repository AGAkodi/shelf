-- NEVER a production migration. Installed only by scripts/install-development.mjs into fixed local Docker DB.
create or replace function public.dev_checkout(p_user uuid,p_book uuid,p_plan uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.books; plan public.borrowing_plans; l public.loans; p public.payments; share bigint;
begin
 perform 1 from auth.users where id=p_user for update;
 if not found then raise exception 'Unknown user' using errcode='42501'; end if;
 select * into p from public.payments where user_id=p_user and idempotency_key=p_key;
 if p.id is not null then
  select * into l from public.loans where id=p.loan_id;
  if l.book_id<>p_book or l.borrowing_plan_id<>p_plan or p.environment<>'development' then raise exception 'Idempotency key conflict' using errcode='23514'; end if;
  return jsonb_build_object('payment',to_jsonb(p),'loan',to_jsonb(l));
 end if;
 update public.loans set status='expired' where user_id=p_user and status='active' and expires_at<=clock_timestamp();
 select * into l from public.loans where user_id=p_user and book_id=p_book and status in ('pending_payment','active');
 if l.id is not null then
  if l.status='pending_payment' and l.borrowing_plan_id=p_plan then
   select * into p from public.payments where loan_id=l.id and environment='development' and status='pending';
   if p.id is not null then return jsonb_build_object('payment',to_jsonb(p),'loan',to_jsonb(l)); end if;
  end if;
  raise exception 'An active loan or different checkout already exists' using errcode='23514';
 end if;
 select * into b from public.books where id=p_book and status='published' for share;
 select * into plan from public.borrowing_plans where id=p_plan and book_id=p_book and enabled for share;
 if b.id is null or plan.id is null then raise exception 'Book or plan unavailable' using errcode='23514'; end if;
 if not exists(select 1 from public.book_licenses where book_id=b.id and distribution_permitted and reviewed_at is not null and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()))
 or not exists(select 1 from public.book_assets where book_id=b.id) then raise exception 'Licensed content unavailable' using errcode='23514'; end if;
 insert into public.loans(user_id,book_id,borrowing_plan_id,duration_days) values(p_user,b.id,plan.id,plan.duration_days) returning * into l;
 share:=case when b.ownership='contributor' then floor(plan.price_units::numeric*4/5)::bigint else 0 end;
 insert into public.payments(loan_id,user_id,gross_amount,ownership,contributor_id,contributor_share,platform_share,recipient,quote_block_number,idempotency_key,environment)
 values(l.id,p_user,plan.price_units,b.ownership,b.contributor_id,share,plan.price_units-share,null,null,p_key,'development') returning * into p;
 return jsonb_build_object('payment',to_jsonb(p),'loan',to_jsonb(l));
end $$;
create or replace function public.dev_complete(p_user uuid,p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments; l public.loans; activated timestamptz;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user for update;
 if p.id is null or p.environment<>'development' then raise exception 'Development payment unavailable' using errcode='42501'; end if;
 select * into l from public.loans where id=p.loan_id for update;
 if p.status='confirmed' then return jsonb_build_object('payment',to_jsonb(p),'loan',to_jsonb(l)); end if;
 if p.status<>'pending' or l.status<>'pending_payment' then raise exception 'Checkout is not pending' using errcode='23514'; end if;
 activated:=clock_timestamp();
 update public.payments set status='submitted',submitted_at=activated where id=p.id;
 update public.payments set status='verifying',last_checked_at=activated where id=p.id;
 update public.payments set status='confirmed',verified_at=activated where id=p.id returning * into p;
 update public.loans set status='active',started_at=activated,expires_at=activated+l.duration_days*interval '24 hours' where id=l.id returning * into l;
 return jsonb_build_object('payment',to_jsonb(p),'loan',to_jsonb(l));
end $$;
create or replace function public.dev_cancel(p_user uuid,p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='development' for update;
 if p.id is null then raise exception 'Checkout unavailable' using errcode='42501'; end if;
 if p.status='cancelled' then return public.library_state(p_user); end if;
 if p.status<>'pending' then raise exception 'Cannot cancel submitted payment' using errcode='23514'; end if;
 update public.payments set status='cancelled' where id=p.id;
 update public.loans set status='cancelled' where id=p.loan_id and status='pending_payment';
 return public.library_state(p_user);
end $$;
revoke all on function public.dev_checkout(uuid,uuid,uuid,uuid),public.dev_complete(uuid,uuid),public.dev_cancel(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dev_checkout(uuid,uuid,uuid,uuid),public.dev_complete(uuid,uuid),public.dev_cancel(uuid,uuid) to service_role;
notify pgrst,'reload schema';
