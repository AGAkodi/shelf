-- Email Auth remains canonical. Wallet proof never creates a user or grants a loan.
create table private.wallet_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 address text not null check(address ~ '^0x[0-9a-f]{40}$'),
 chain_id integer not null default 137 check(chain_id=137),
 origin text not null check(length(origin) between 8 and 256),
 nonce text not null unique check(nonce ~ '^0x[0-9a-f]{64}$'),
 secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 consumed_at timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 5)
);
create index wallet_challenges_user_time on private.wallet_challenges(user_id,created_at desc);
create table private.verified_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 address text not null check(address ~ '^0x[0-9a-f]{40}$'),
 chain_id integer not null default 137 check(chain_id=137),
 verified_at timestamptz not null default clock_timestamp(),
 unique(chain_id,address)
);
create table private.wallet_session_proofs (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references private.verified_wallets(user_id) on delete cascade,
 verified_at timestamptz not null default clock_timestamp()
);
alter table private.wallet_challenges enable row level security;
alter table private.verified_wallets enable row level security;
alter table private.wallet_session_proofs enable row level security;
revoke all on private.wallet_challenges,private.verified_wallets,private.wallet_session_proofs from public,anon,authenticated;

create function private.require_wallet_session(p_user uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=p_session and s.user_id=p_user and u.email_confirmed_at is not null
 and (s.not_after is null or s.not_after>clock_timestamp())) then
 raise exception 'Confirmed session required' using errcode='42501'; end if;
end $$;
revoke all on function private.require_wallet_session(uuid,uuid) from public,anon,authenticated;

create function public.wallet_challenge_create(p_user uuid,p_session uuid,p_address text,p_origin text,p_nonce text,p_secret_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.wallet_challenges;
begin
 perform private.require_wallet_session(p_user,p_session);
 perform 1 from auth.users where id=p_user for update;
 -- Bounded retained history and a per-user issuance throttle, enforced across sessions/tabs.
 delete from private.wallet_challenges where user_id=p_user and created_at<clock_timestamp()-interval '1 day';
 if (select count(*) from private.wallet_challenges where user_id=p_user and created_at>clock_timestamp()-interval '10 minutes')>=10 then
 raise exception 'Challenge rate limit' using errcode='P0001'; end if;
 if exists(select 1 from private.verified_wallets where (user_id=p_user and address<>p_address) or (address=p_address and user_id<>p_user)) then
 raise exception 'Wallet association unavailable' using errcode='42501'; end if;
 update private.wallet_challenges set consumed_at=clock_timestamp() where user_id=p_user and session_id=p_session and consumed_at is null;
 insert into private.wallet_challenges(user_id,session_id,address,origin,nonce,secret_hash)
 values(p_user,p_session,p_address,p_origin,p_nonce,p_secret_hash) returning * into c;
 return to_jsonb(c)-'secret_hash';
end $$;

create function public.wallet_challenge_attempt(p_user uuid,p_session uuid,p_id uuid,p_origin text,p_secret_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.wallet_challenges;
begin
 perform private.require_wallet_session(p_user,p_session);
 update private.wallet_challenges set attempts=attempts+1 where id=p_id and user_id=p_user and session_id=p_session
 and origin=p_origin and secret_hash=p_secret_hash and consumed_at is null and expires_at>clock_timestamp() and attempts<5 returning * into c;
 if c.id is null then raise exception 'Challenge unavailable' using errcode='42501'; end if;
 return to_jsonb(c)-'secret_hash';
end $$;

create function public.wallet_challenge_consume(p_user uuid,p_session uuid,p_id uuid,p_origin text,p_secret_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.wallet_challenges; w private.verified_wallets;
begin
 perform private.require_wallet_session(p_user,p_session);
 perform 1 from auth.users where id=p_user for update;
 update private.wallet_challenges set consumed_at=clock_timestamp() where id=p_id and user_id=p_user and session_id=p_session
 and origin=p_origin and secret_hash=p_secret_hash and consumed_at is null and expires_at>clock_timestamp() and attempts>0 returning * into c;
 if c.id is null then raise exception 'Challenge already used or expired' using errcode='42501'; end if;
 select * into w from private.verified_wallets where user_id=p_user;
 if w.user_id is not null and w.address<>c.address then raise exception 'Wallet association cannot be replaced' using errcode='42501'; end if;
 insert into private.verified_wallets(user_id,address) values(p_user,c.address)
 on conflict(user_id) do update set verified_at=clock_timestamp() returning * into w;
 insert into private.wallet_session_proofs(session_id,user_id) values(p_session,p_user)
 on conflict(session_id) do update set verified_at=clock_timestamp();
 return jsonb_build_object('address',w.address,'chain_id',w.chain_id,'session_verified',true);
end $$;

create function public.wallet_status(p_user uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w private.verified_wallets;
begin
 perform private.require_wallet_session(p_user,p_session);
 select * into w from private.verified_wallets where user_id=p_user;
 return jsonb_build_object('address',w.address,'chain_id',w.chain_id,'session_verified',exists(select 1 from private.wallet_session_proofs where session_id=p_session and user_id=p_user));
end $$;
create function public.wallet_invalidate(p_user uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_wallet_session(p_user,p_session);
 perform 1 from auth.users where id=p_user for update;
 delete from private.wallet_session_proofs where session_id=p_session and user_id=p_user;
 update private.wallet_challenges set consumed_at=clock_timestamp() where user_id=p_user and session_id=p_session and consumed_at is null;
end $$;
revoke all on function public.wallet_challenge_create(uuid,uuid,text,text,text,text),public.wallet_challenge_attempt(uuid,uuid,uuid,text,text),public.wallet_challenge_consume(uuid,uuid,uuid,text,text),public.wallet_status(uuid,uuid),public.wallet_invalidate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.wallet_challenge_create(uuid,uuid,text,text,text,text),public.wallet_challenge_attempt(uuid,uuid,uuid,text,text),public.wallet_challenge_consume(uuid,uuid,uuid,text,text),public.wallet_status(uuid,uuid),public.wallet_invalidate(uuid,uuid) to service_role;
