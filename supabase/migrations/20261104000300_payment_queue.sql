create function public.payment_queue() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(q)),'[]'::jsonb) from (
  select p.id,p.user_id,d.candidate_hash from public.payments p join private.payment_dispatch d on d.payment_id=p.id
  where p.environment='production' and p.status='pending' and d.candidate_hash is not null
  and (d.checked_at is null or d.checked_at<clock_timestamp()-interval '30 seconds')
  order by d.checked_at nulls first,p.created_at limit 20
 ) q;
$$;
revoke all on function public.payment_queue() from public,anon,authenticated;
grant execute on function public.payment_queue() to service_role;
