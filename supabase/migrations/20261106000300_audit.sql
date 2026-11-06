-- The database owns review metadata and application identifiers.
revoke insert on public.contributor_applications from authenticated;
grant insert(user_id,name,contact,contributor_type,description,rights_information)
  on public.contributor_applications to authenticated;

-- Bind a rejection to the individual wallet prompt. Never return the claim token
-- from status or recovery APIs. Existing unresolved prompts stay reserved.
alter table private.payment_dispatch add column claim_token uuid;
create function public.payment_prompt(p_user uuid,p_session uuid,p_payment uuid,p_action text,p_token uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; issued uuid;
begin
  perform 1 from auth.users where id=p_user for update;
  if p_action='claim' then
    result:=public.payment_dispatch(p_user,p_session,p_payment,'claim');
    if result->'payment'->>'status'='pending' then
      issued:=gen_random_uuid();
      update private.payment_dispatch set claim_token=issued where payment_id=p_payment;
      return result || jsonb_build_object('claim_token',issued);
    end if;
  elsif p_action='rejected' then
    update private.payment_dispatch set claim_token=null
      where payment_id=p_payment and claim_token=p_token and prompted and candidate_hash is null;
    if not found then raise exception 'Stale wallet prompt' using errcode='42501'; end if;
    result:=public.payment_dispatch(p_user,p_session,p_payment,'rejected');
  else raise exception 'Unknown prompt operation';
  end if;
  return result;
end $$;
revoke all on function public.payment_prompt(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.payment_prompt(uuid,uuid,uuid,text,uuid) to service_role;
