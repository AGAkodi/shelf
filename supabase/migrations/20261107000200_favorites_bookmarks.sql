-- Reader favorites and bookmarks. Both are private to their owner. Bookmarks store only a position
-- (chapter and paragraph index), never book text, so no protected content leaves the per-request
-- loan checks of the chapter delivery function.

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter integer not null check (chapter between 1 and 100000),
  paragraph integer not null check (paragraph between 0 and 999),
  created_at timestamptz not null default now(),
  unique (user_id, book_id, chapter, paragraph)
);
create index bookmarks_reader_book on public.bookmarks(user_id, book_id);

alter table public.favorites enable row level security;
alter table public.bookmarks enable row level security;
revoke all on public.favorites, public.bookmarks from anon, authenticated;
grant all on public.favorites, public.bookmarks to service_role;
grant select, delete on public.favorites, public.bookmarks to authenticated;
grant insert(user_id, book_id) on public.favorites to authenticated;
grant insert(user_id, book_id, chapter, paragraph) on public.bookmarks to authenticated;

create policy favorites_own on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_remove on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
-- Only published books can be added; the books policy already hides drafts from readers.
create policy favorites_add on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.books b where b.id = book_id and b.status = 'published'));

create policy bookmarks_own on public.bookmarks for select to authenticated using (user_id = (select auth.uid()));
create policy bookmarks_remove on public.bookmarks for delete to authenticated using (user_id = (select auth.uid()));
-- A reader bookmarks while reading: an active, unexpired loan of that book is required.
create policy bookmarks_add on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.loans l
    where l.user_id = (select auth.uid()) and l.book_id = bookmarks.book_id
      and l.status = 'active' and l.expires_at > now()));

-- Bound the rows one reader can create per book.
create function private.limit_bookmarks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.bookmarks where user_id = new.user_id and book_id = new.book_id) >= 200 then
    raise exception 'Bookmark limit reached for this book' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.limit_bookmarks() from public, anon, authenticated;
create trigger bookmarks_limit before insert on public.bookmarks for each row execute function private.limit_bookmarks();
