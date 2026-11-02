-- Shelf Phase 2: data boundaries only. No checkout or payment-finalization RPC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('reader', 'admin');
create type public.contributor_type as enum ('author', 'publisher');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.book_ownership as enum ('platform', 'contributor');
create type public.book_status as enum ('draft', 'published');
create type public.loan_status as enum ('pending_payment', 'active', 'returned', 'expired', 'cancelled');
create type public.payment_status as enum ('pending', 'submitted', 'verifying', 'confirmed', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'reader',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create table public.contributor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 120),
  contact text not null check (length(trim(contact)) between 3 and 320),
  contributor_type public.contributor_type not null,
  description text not null check (length(trim(description)) between 1 and 5000),
  rights_information text not null check (length(trim(rights_information)) between 1 and 10000),
  status public.application_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text check (length(review_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null and reviewed_at >= created_at))
);
create unique index applications_one_pending on public.contributor_applications(user_id) where status = 'pending';
create index applications_review_queue on public.contributor_applications(status, created_at);
create index applications_user on public.contributor_applications(user_id);
create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  -- NULL permits an operator-managed rights holder that has not claimed an account.
  user_id uuid unique references auth.users(id),
  application_id uuid unique references public.contributor_applications(id),
  name text not null check (length(trim(name)) between 1 and 120),
  contact text not null check (length(trim(contact)) between 3 and 320),
  contributor_type public.contributor_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 240),
  author text not null check (length(trim(author)) between 1 and 240),
  description text not null check (length(description) <= 10000),
  category text not null check (length(trim(category)) between 1 and 80),
  public_preview text not null default '' check (length(public_preview) <= 15000),
  cover_path text check (cover_path ~ '^[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$'),
  cover_alt text not null default '' check (length(cover_alt) <= 300),
  ownership public.book_ownership not null default 'platform',
  contributor_id uuid references public.contributors(id),
  status public.book_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((ownership = 'platform' and contributor_id is null) or (ownership = 'contributor' and contributor_id is not null))
);
create index books_catalogue on public.books(status, category, title);
create index books_contributor on public.books(contributor_id);
create index books_search on public.books using gin (to_tsvector('english', title || ' ' || author || ' ' || description));
create table public.book_licenses (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id),
  rights_holder text not null check (length(trim(rights_holder)) between 1 and 240),
  rights_evidence text not null check (length(trim(rights_evidence)) between 1 and 10000),
  distribution_permitted boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text check (length(review_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  -- A privileged operator may review demo rights without an application account.
  check (not distribution_permitted or reviewed_at is not null)
);
create index licenses_book on public.book_licenses(book_id);
create table public.book_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id),
  bucket_id text not null default 'protected-books' check (bucket_id = 'protected-books'),
  object_path text not null unique check (object_path ~ '^[a-zA-Z0-9/_-]+\.json$'),
  format text not null default 'chapter-text-v1' check (format = 'chapter-text-v1'),
  mime_type text not null default 'application/json' check (mime_type = 'application/json'),
  chapter_number integer not null check (chapter_number > 0),
  version integer not null default 1 check (version > 0),
  byte_size bigint not null check (byte_size between 1 and 1048576),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, version, chapter_number)
);
create table public.borrowing_plans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id),
  duration_days integer not null check (duration_days in (3, 7, 14)),
  price_units bigint not null check (price_units between 1 and 9007199254740991),
  token text not null default 'USDT' check (token = 'USDT'),
  token_contract text not null default '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
    check (token_contract = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'),
  chain_id bigint not null default 137 check (chain_id = 137),
  decimals smallint not null default 6 check (decimals = 6),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, duration_days),
  unique (id, book_id)
);
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  book_id uuid not null references public.books(id),
  borrowing_plan_id uuid not null,
  duration_days integer not null check (duration_days in (3, 7, 14)),
  status public.loan_status not null default 'pending_payment',
  started_at timestamptz,
  expires_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (borrowing_plan_id, book_id) references public.borrowing_plans(id, book_id),
  unique (id, user_id),
  check (
    (status in ('pending_payment', 'cancelled') and started_at is null and expires_at is null and returned_at is null)
    or (status in ('active', 'expired', 'returned') and started_at is not null and started_at >= created_at
      and expires_at is not null and expires_at = started_at + duration_days * interval '24 hours'
      and ((status = 'returned' and returned_at is not null and returned_at >= started_at and returned_at < expires_at)
        or (status <> 'returned' and returned_at is null)))
  )
);
create unique index loans_one_open on public.loans(user_id, book_id) where status in ('pending_payment', 'active');
create index loans_user_history on public.loans(user_id, created_at desc);
create index loans_expiry on public.loans(expires_at) where status = 'active';
create index loans_book on public.loans(book_id);
create index loans_plan on public.loans(borrowing_plan_id);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null,
  user_id uuid not null references auth.users(id),
  gross_amount bigint not null check (gross_amount between 1 and 9007199254740991),
  ownership public.book_ownership not null,
  contributor_id uuid references public.contributors(id),
  contributor_share bigint not null,
  platform_share bigint not null,
  token text not null default 'USDT' check (token = 'USDT'),
  token_contract text not null default '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
    check (token_contract = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'),
  chain_id bigint not null default 137 check (chain_id = 137),
  decimals smallint not null default 6 check (decimals = 6),
  recipient text not null check (recipient ~ '^0x[0-9a-f]{40}$' and recipient <> '0x0000000000000000000000000000000000000000'),
  expected_sender text check (expected_sender ~ '^0x[0-9a-f]{40}$' and expected_sender <> '0x0000000000000000000000000000000000000000'),
  quote_block_number bigint not null check (quote_block_number >= 0),
  status public.payment_status not null default 'pending',
  tx_hash text check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  block_number bigint check (block_number > quote_block_number),
  block_hash text check (block_hash ~ '^0x[0-9a-f]{64}$'),
  block_timestamp timestamptz,
  submitted_at timestamptz,
  last_checked_at timestamptz,
  verified_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (loan_id, user_id) references public.loans(id, user_id),
  unique (user_id, idempotency_key),
  check ((ownership = 'platform' and contributor_id is null and contributor_share = 0)
    or (ownership = 'contributor' and contributor_id is not null and contributor_share = floor(gross_amount::numeric * 4 / 5))),
  check (contributor_share >= 0 and platform_share >= 0 and platform_share = gross_amount - contributor_share),
  check (submitted_at is null or submitted_at >= created_at),
  check (last_checked_at is null or last_checked_at >= created_at),
  check (block_timestamp is null or block_timestamp >= created_at),
  check ((status = 'confirmed' and verified_at is not null and verified_at >= created_at
    and tx_hash is not null and expected_sender is not null and block_number is not null
    and block_hash is not null and block_timestamp is not null and submitted_at is not null
    and verified_at >= block_timestamp) or (status <> 'confirmed' and verified_at is null)),
  check (status not in ('submitted', 'verifying') or (tx_hash is not null and submitted_at is not null and expected_sender is not null))
);
create unique index payments_chain_hash on public.payments(chain_id, lower(tx_hash)) where tx_hash is not null;
create unique index payments_one_confirmed_loan on public.payments(loan_id) where status = 'confirmed';
create index payments_loan_user on public.payments(loan_id, user_id);
create index payments_user_history on public.payments(user_id, created_at desc);
create index payments_reconciliation on public.payments(status, updated_at);
create index payments_contributor on public.payments(contributor_id);

create function private.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create function private.provision_user() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  insert into public.user_roles(user_id, role) values (new.id, 'reader');
  return new;
end;
$$;
revoke all on function private.provision_user() from public, anon, authenticated;
create trigger shelf_new_user after insert on auth.users for each row execute function private.provision_user();
-- Also safe to apply to a project with existing Auth users.
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.user_roles(user_id, role) select id, 'reader' from auth.users on conflict do nothing;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create function private.protect_loan_terms() returns trigger language plpgsql set search_path = '' as $$
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
  if new.status = 'expired' and new.expires_at > now() then
    raise exception 'Loan has not expired' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_loan_terms() from public, anon, authenticated;
create trigger loan_terms before update on public.loans for each row execute function private.protect_loan_terms();

create function private.protect_payment_terms() returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.id, new.loan_id, new.user_id, new.gross_amount, new.ownership, new.contributor_id,
    new.contributor_share, new.platform_share, new.token, new.token_contract, new.chain_id, new.decimals,
    new.recipient, new.expected_sender, new.quote_block_number, new.idempotency_key, new.created_at)
    is distinct from row(old.id, old.loan_id, old.user_id, old.gross_amount, old.ownership, old.contributor_id,
    old.contributor_share, old.platform_share, old.token, old.token_contract, old.chain_id, old.decimals,
    old.recipient, old.expected_sender, old.quote_block_number, old.idempotency_key, old.created_at)
    or (old.tx_hash is not null and lower(new.tx_hash) is distinct from lower(old.tx_hash))
    or (old.status in ('confirmed', 'failed', 'cancelled') and
      (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at')) then
    raise exception 'Payment terms or final record are immutable' using errcode = '23514';
  end if;
  if new.status <> old.status and not (
    (old.status = 'pending' and new.status in ('submitted', 'cancelled')) or
    (old.status = 'submitted' and new.status in ('verifying', 'failed')) or
    (old.status = 'verifying' and new.status in ('confirmed', 'failed'))
  ) then raise exception 'Invalid payment transition' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.protect_payment_terms() from public, anon, authenticated;
create trigger payment_terms before update on public.payments for each row execute function private.protect_payment_terms();

create function private.retain_financial_history() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'payments' then
    if old.tx_hash is not null or old.status = 'confirmed' then
      raise exception 'Claimed transactions must be retained' using errcode = '23514';
    end if;
  elsif old.started_at is not null then
    raise exception 'Activated loans must be retained' using errcode = '23514';
  end if;
  return old;
end;
$$;
revoke all on function private.retain_financial_history() from public, anon, authenticated;
create trigger retain_payment before delete on public.payments for each row execute function private.retain_financial_history();
create trigger retain_loan before delete on public.loans for each row execute function private.retain_financial_history();

-- Deferred checks permit a future verifier to confirm and activate atomically, never one side alone.
create function private.check_paid_loan() returns trigger language plpgsql set search_path = '' as $$
declare target uuid; l public.loans; p public.payments;
begin
  if tg_table_name = 'loans' then target := new.id; else target := new.loan_id; end if;
  select * into l from public.loans where id = target;
  select * into p from public.payments where loan_id = target and status = 'confirmed';
  if l.status in ('active', 'returned', 'expired') and p.id is null then
    raise exception 'Loan requires confirmed payment' using errcode = '23514';
  end if;
  if p.id is not null and (l.status not in ('active', 'returned', 'expired') or l.started_at <> p.verified_at) then
    raise exception 'Confirmed payment requires matching loan activation' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function private.check_paid_loan() from public, anon, authenticated;
create constraint trigger paid_loan after insert or update on public.loans deferrable initially deferred
  for each row execute function private.check_paid_loan();
create constraint trigger paid_payment after insert or update on public.payments deferrable initially deferred
  for each row execute function private.check_paid_loan();

create function private.require_publishable_book() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and (
    not exists (select 1 from public.book_licenses where book_id = new.id and distribution_permitted
      and reviewed_at is not null and valid_from <= now() and (valid_until is null or valid_until > now()))
    or not exists (select 1 from public.book_assets where book_id = new.id)
  ) then raise exception 'Publication requires reviewed distribution rights and private asset metadata' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.require_publishable_book() from public, anon, authenticated;
create trigger publish_book before insert or update on public.books for each row execute function private.require_publishable_book();

do $$ declare t text; begin
  foreach t in array array['profiles','contributors','contributor_applications','books','book_licenses','book_assets','borrowing_plans','loans','payments','user_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    if t <> 'user_roles' then
      execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
    end if;
  end loop;
end $$;

grant select on public.books, public.borrowing_plans to anon, authenticated;
grant select on public.profiles, public.user_roles, public.contributors, public.contributor_applications,
  public.book_licenses, public.book_assets, public.loans, public.payments to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert on public.contributor_applications to authenticated;
grant update(status, reviewed_by, reviewed_at, review_notes) on public.contributor_applications to authenticated;
grant insert, update, delete on public.books, public.borrowing_plans, public.book_licenses, public.book_assets, public.contributors to authenticated;

create policy books_public on public.books for select to anon, authenticated using (status = 'published');
create policy plans_public on public.borrowing_plans for select to anon, authenticated
  using (enabled and exists (select 1 from public.books b where b.id = book_id and b.status = 'published'));
create policy profiles_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_own on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy contributors_own on public.contributors for select to authenticated using (user_id = (select auth.uid()));
create policy applications_own on public.contributor_applications for select to authenticated using (user_id = (select auth.uid()));
create policy applications_submit on public.contributor_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null);
create policy applications_review on public.contributor_applications for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()) and reviewed_by = (select auth.uid()));
create policy loans_own on public.loans for select to authenticated using (user_id = (select auth.uid()));
create policy payments_own on public.payments for select to authenticated using (user_id = (select auth.uid()));

do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','contributor_applications','loans','payments'] loop
    execute format('create policy admin_read on public.%I for select to authenticated using ((select private.is_admin()))', t);
  end loop;
  foreach t in array array['books','borrowing_plans','book_licenses','book_assets','contributors'] loop
    execute format('create policy admin_manage on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

-- No direct role/loan/payment writes even for browser-authenticated administrators.
-- Bootstrap roles through the documented privileged operator SQL procedure.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('covers', 'covers', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('protected-books', 'protected-books', false, 1048576, array['application/json']);
create policy cover_read on storage.objects for select to anon, authenticated using (bucket_id = 'covers');
create policy admin_asset_read on storage.objects for select to authenticated
  using (bucket_id = 'protected-books' and (select private.is_admin()));
create policy admin_asset_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('covers','protected-books') and (select private.is_admin()));
create policy admin_asset_update on storage.objects for update to authenticated
  using (bucket_id in ('covers','protected-books') and (select private.is_admin()))
  with check (bucket_id in ('covers','protected-books') and (select private.is_admin()));
create policy admin_asset_delete on storage.objects for delete to authenticated
  using (bucket_id in ('covers','protected-books') and (select private.is_admin()));
