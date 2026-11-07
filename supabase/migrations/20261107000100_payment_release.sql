-- Recovery for a wallet prompt that never produced a transaction (for example a send that the
-- wallet failed before broadcast). Without this, the payment stays "prompted" with no candidate
-- hash: claim, cancel and reconciliation all refuse it, and the reader cannot borrow that book.
--
-- Release is service-only. The payments Edge function calls it only after its own Polygon RPC
-- shows no pending sender transaction and no USDT Transfer from the quoted sender to the
-- recipient after the quote block. This routine additionally enforces ownership, state and a
-- 15-minute wait since the prompt, under the same user and payment locks as the other routines.

alter table private.payment_dispatch add column prompted_at timestamptz;

create function private.payment_dispatch_prompted_at() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.prompted and not coalesce(old.prompted, false) then
    new.prompted_at := clock_timestamp();
  elsif not new.prompted then
    new.prompted_at := null;
  end if;
  return new;
end $$;
create trigger payment_dispatch_prompted_at before update of prompted on private.payment_dispatch
  for each row execute function private.payment_dispatch_prompted_at();

-- Same result as before plus prompted_at, so the reader can see when release becomes possible.
create or replace function public.payment_state(p_user uuid,p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments; d private.payment_dispatch;
begin
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production';
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 select * into d from private.payment_dispatch where payment_id=p.id;
 return jsonb_build_object('payment',to_jsonb(p)||jsonb_build_object('gross_amount',p.gross_amount::text,'quote_block_number',p.quote_block_number::text),
 'loan',(select to_jsonb(l) from public.loans l where id=p.loan_id),'prompted',coalesce(d.prompted,false),'candidate_hash',d.candidate_hash,
 'prompted_at',d.prompted_at);
end $$;

create function public.payment_release(p_user uuid,p_session uuid,p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.payments; d private.payment_dispatch;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production' for update;
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 select * into d from private.payment_dispatch where payment_id=p.id for update;
 if p.status<>'pending' or not d.prompted or d.candidate_hash is not null then
  raise exception 'Payment not releasable' using errcode='23514';
 end if;
 -- Prompts recorded before this migration have no timestamp and are old enough by definition.
 if d.prompted_at is not null and d.prompted_at>clock_timestamp()-interval '15 minutes' then
  raise exception 'Release not yet available' using errcode='23514';
 end if;
 update private.payment_dispatch set prompted=false,claim_token=null where payment_id=p.id;
 return public.payment_state(p_user,p.id);
end $$;

revoke all on function public.payment_release(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.payment_release(uuid,uuid,uuid) to service_role;
revoke all on function private.payment_dispatch_prompted_at() from public,anon,authenticated;
-- create or replace keeps existing grants; restate them so the boundary is explicit.
revoke all on function public.payment_state(uuid,uuid) from public,anon,authenticated;
grant execute on function public.payment_state(uuid,uuid) to service_role;
