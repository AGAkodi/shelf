
-- Only independently verified, finalized reverted transactions reach this service-only routine.
create function public.payment_fail(p_user uuid,p_payment uuid,p_hash text,p_block bigint,p_block_hash text,p_block_time timestamptz,p_finalized bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into p from public.payments where id=p_payment and user_id=p_user and environment='production' for update;
 if p.id is null then raise exception 'Payment unavailable' using errcode='42501'; end if;
 if p.status='failed' and p.tx_hash=p_hash then return public.payment_state(p_user,p.id); end if;
 if p.status<>'pending' or p_block<=p.quote_block_number or p_block>p_finalized or p_block_time<p.created_at or p_block_time>clock_timestamp() then raise exception 'Invalid failure evidence' using errcode='23514'; end if;
 update public.payments set status='submitted',tx_hash=p_hash,submitted_at=clock_timestamp() where id=p.id;
 update public.payments set status='failed',block_number=p_block,block_hash=p_block_hash,block_timestamp=p_block_time,last_checked_at=clock_timestamp() where id=p.id;
 update public.loans set status='cancelled' where id=p.loan_id and status='pending_payment';
 return public.payment_state(p_user,p.id);
end $$;
revoke all on function public.payment_fail(uuid,uuid,text,bigint,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.payment_fail(uuid,uuid,text,bigint,text,timestamptz,bigint) to service_role;
