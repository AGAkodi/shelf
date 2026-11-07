begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.rejects(command text, expected text, description text) returns text
language plpgsql as $$
begin
  execute command;
  return extensions.fail(description || ': unexpectedly succeeded');
exception when others then
  return extensions.is(sqlstate, expected, description);
end $$;

-- Fixtures roll back with the transaction. Seed books: ...0001 published, ...0003 draft.
insert into auth.users(id) values ('d0000000-0000-4000-8000-000000000001'), ('d0000000-0000-4000-8000-000000000002');
insert into public.loans(id,user_id,book_id,borrowing_plan_id,duration_days) values
 ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',7);
-- An older loan whose access period has already ended.
insert into public.loans(id,user_id,book_id,borrowing_plan_id,duration_days,created_at) values
 ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',
  (select id from public.borrowing_plans where book_id='20000000-0000-4000-8000-000000000002' and duration_days=7),7,now()-interval '8 days');
-- Activation evidence is enforced by deferred constraints at commit; this test never commits.
update public.loans set status='active', started_at=created_at, expires_at=created_at+interval '7 days'
  where id in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002');

select ok(not has_table_privilege('anon','public.favorites','select'), 'Anon cannot read favorites');
select ok(not has_table_privilege('anon','public.bookmarks','select'), 'Anon cannot read bookmarks');
select ok(not has_column_privilege('authenticated','public.bookmarks','created_at','insert'), 'Readers cannot set bookmark timestamps');
select ok(not has_table_privilege('authenticated','public.favorites','update'), 'Favorites cannot be updated');
select ok(not has_table_privilege('authenticated','public.bookmarks','update'), 'Bookmarks cannot be updated');
select ok(not has_function_privilege('authenticated','private.limit_bookmarks()','execute'), 'Bookmark limit helper not callable');

set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
select lives_ok($$insert into public.favorites(user_id,book_id) values (auth.uid(),'20000000-0000-4000-8000-000000000001')$$, 'Reader favorites a published book');
select pg_temp.rejects($$insert into public.favorites(user_id,book_id) values (auth.uid(),'20000000-0000-4000-8000-000000000003')$$, '42501', 'Draft books cannot be favorited');
select pg_temp.rejects($$insert into public.favorites(user_id,book_id) values ('d0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001')$$, '42501', 'Cannot favorite for another reader');
select pg_temp.rejects($$insert into public.favorites(user_id,book_id) values (auth.uid(),'20000000-0000-4000-8000-000000000001')$$, '23505', 'A book is favorited once');
select lives_ok($$insert into public.bookmarks(user_id,book_id,chapter,paragraph) values (auth.uid(),'20000000-0000-4000-8000-000000000001',1,3)$$, 'Reader bookmarks a book on active loan');
select pg_temp.rejects($$insert into public.bookmarks(user_id,book_id,chapter,paragraph) values (auth.uid(),'20000000-0000-4000-8000-000000000002',1,0)$$, '42501', 'No bookmark without an active loan');
select pg_temp.rejects($$insert into public.bookmarks(user_id,book_id,chapter,paragraph) values (auth.uid(),'20000000-0000-4000-8000-000000000001',0,0)$$, '23514', 'Chapter must be positive');
select pg_temp.rejects($$insert into public.bookmarks(user_id,book_id,chapter,paragraph,created_at) values (auth.uid(),'20000000-0000-4000-8000-000000000001',1,4,'2000-01-01')$$, '42501', 'Bookmark timestamp is database-owned');
select is((select count(*)::int from public.favorites), 1, 'Reader sees own favorite');
select is((select count(*)::int from public.bookmarks), 1, 'Reader sees own bookmark');

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.favorites), 0, 'Other reader sees no favorites');
select is((select count(*)::int from public.bookmarks), 0, 'Other reader sees no bookmarks');
select pg_temp.rejects($$insert into public.bookmarks(user_id,book_id,chapter,paragraph) values (auth.uid(),'20000000-0000-4000-8000-000000000002',1,0)$$, '42501', 'Expired loan cannot add bookmarks');
delete from public.favorites;
delete from public.bookmarks;
reset role;
select is((select count(*)::int from public.favorites where user_id='d0000000-0000-4000-8000-000000000001'), 1, 'Other reader cannot delete favorites');
select is((select count(*)::int from public.bookmarks where user_id='d0000000-0000-4000-8000-000000000001'), 1, 'Other reader cannot delete bookmarks');

-- Per-book bookmark cap.
insert into public.bookmarks(user_id,book_id,chapter,paragraph)
  select 'd0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2,n from generate_series(0,198) n;
select pg_temp.rejects($$insert into public.bookmarks(user_id,book_id,chapter,paragraph) values ('d0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',3,0)$$, '23514', 'At most 200 bookmarks per reader and book');

set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
delete from public.favorites;
select is((select count(*)::int from public.favorites), 0, 'Reader removes own favorite');
reset role;

select * from finish();
rollback;
