-- Production chapter delivery requires the confirmed rental as well as an active loan.
create function public.authorize_paid_chapter(p_user uuid, p_loan uuid, p_book uuid, p_chapter integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.payments
    where user_id = p_user and loan_id = p_loan and environment = 'production'
      and status = 'confirmed' and tx_hash is not null and verified_at is not null
  ) then
    raise exception 'Reading access denied' using errcode = '42501';
  end if;
  return public.authorize_chapter(p_user, p_loan, p_book, p_chapter);
end $$;
revoke all on function public.authorize_paid_chapter(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.authorize_paid_chapter(uuid,uuid,uuid,integer) to service_role;
