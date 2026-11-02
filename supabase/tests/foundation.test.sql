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

select is((select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity), 10, 'RLS enabled on all ten application tables');
select is((select data_type from information_schema.columns where table_schema='public' and table_name='payments' and column_name='gross_amount'), 'bigint', 'Payment amount is bigint');
select is((select count(*)::int from public.books), 3, 'Three original demo books seeded');
select is((select count(*)::int from public.payments), 0, 'No fabricated seed payments');
select is((select count(*)::int from public.loans), 0, 'No fabricated seed loans');
select is((select count(*)::int from public.borrowing_plans), 7, 'Per-book plans seeded');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='payments_chain_hash' and indexdef like '%UNIQUE%lower(tx_hash)%'), 'Unique normalized transaction index exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='loans_one_open' and indexdef like '%UNIQUE%'), 'Open loan uniqueness exists');
select is((select public from storage.buckets where id='protected-books'), false, 'Protected bucket is private');
select is((select public from storage.buckets where id='covers'), true, 'Covers bucket is public');
select is((select file_size_limit from storage.buckets where id='protected-books'), 1048576::bigint, 'Chapters limited to one MiB');
select is((select allowed_mime_types from storage.buckets where id='protected-books'), array['application/json'], 'Only structured JSON chapters allowed');
select ok(not has_function_privilege('anon', 'private.is_admin()', 'execute'), 'Anon cannot execute admin helper');
select ok(not has_function_privilege('authenticated', 'private.provision_user()', 'execute'), 'User provisioning not callable');
select ok(not has_function_privilege('authenticated', 'private.check_paid_loan()', 'execute'), 'No callable payment activation helper');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosecdef and not ('search_path=""' = any(p.proconfig))), 0, 'All definer functions have empty search_path');

-- SQL fixtures roll back. Separate HTTP tests create/sign in real users through Auth.
insert into auth.users(id) values
 ('a0000000-0000-4000-8000-000000000001'), ('a0000000-0000-4000-8000-000000000002'), ('a0000000-0000-4000-8000-000000000003');
insert into public.user_roles(user_id,role) values ('a0000000-0000-4000-8000-000000000003','admin');
insert into public.loans(id,user_id,book_id,borrowing_plan_id,duration_days) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',7),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',7);
insert into public.payments(id,loan_id,user_id,gross_amount,ownership,contributor_share,platform_share,recipient,expected_sender,quote_block_number,idempotency_key) values
 ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',2000000,'platform',0,2000000,'0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222',100,gen_random_uuid()),
 ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',2000000,'platform',0,2000000,'0x1111111111111111111111111111111111111111','0x3333333333333333333333333333333333333333',100,gen_random_uuid());
insert into public.contributor_applications(user_id,name,contact,contributor_type,description,rights_information) values
 ('a0000000-0000-4000-8000-000000000001','A','a@example.invalid','author','Original work','Own work'),
 ('a0000000-0000-4000-8000-000000000002','B','b@example.invalid','publisher','Original work','Own work');
-- Only transactional metadata fixtures; HTTP tests exercise actual private bytes.
insert into storage.objects(bucket_id,name) values ('protected-books','test-private.json'),('covers','test-cover.png');

set local role anon;
select is((select count(*)::int from public.books), 2, 'Anon sees published books only');
select is((select count(*)::int from public.borrowing_plans), 5, 'Anon sees enabled plans of published books only');
select is((select count(*)::int from storage.objects where bucket_id='protected-books'), 0, 'Anon cannot select private objects');
select pg_temp.rejects('select * from public.book_assets','42501','Anon cannot read asset paths');
select pg_temp.rejects('select * from public.book_licenses','42501','Anon cannot read rights evidence');
select pg_temp.rejects('select * from public.contributors','42501','Anon cannot read contributor contacts');
select pg_temp.rejects('select * from public.loans','42501','Anon cannot read loans');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.profiles), 1, 'Reader sees own profile only');
select is((select count(*)::int from public.loans), 1, 'Reader A sees only own loan');
select is((select count(*)::int from public.payments), 1, 'Reader A sees only own payment');
select is((select count(*)::int from public.contributor_applications), 1, 'Reader A sees own application only');
select is((select count(*)::int from public.loans where user_id='a0000000-0000-4000-8000-000000000002'), 0, 'Reader B loan inaccessible to A');
select is((select count(*)::int from public.book_assets), 0, 'Reader cannot see private asset mapping');
select is((select count(*)::int from public.book_licenses), 0, 'Reader cannot see licenses');
select is((select count(*)::int from storage.objects where bucket_id='protected-books'), 0, 'Reader cannot select private objects');
select is((select private.is_admin()), false, 'Reader is not admin');
select pg_temp.rejects($$insert into public.user_roles(user_id,role) values (auth.uid(),'admin')$$,'42501','Reader cannot grant role');
select pg_temp.rejects($$update public.user_roles set role='admin'$$,'42501','Reader cannot update role');
select pg_temp.rejects($$update public.payments set status='confirmed'$$,'42501','Reader cannot confirm payment');
select pg_temp.rejects($$update public.payments set gross_amount=1$$,'42501','Reader cannot change quote amount');
select pg_temp.rejects($$update public.payments set platform_share=0$$,'42501','Reader cannot change revenue');
select pg_temp.rejects($$update public.loans set status='active'$$,'42501','Reader cannot activate loan');
select pg_temp.rejects($$delete from public.payments$$,'42501','Reader cannot free transaction claim');
select pg_temp.rejects($$insert into public.contributors(name,contact,contributor_type) values ('Escalation','x@example.invalid','author')$$,'42501','Reader cannot approve contributor');
select pg_temp.rejects($$insert into storage.objects(bucket_id,name) values ('protected-books','evil.json')$$,'42501','Reader cannot upload private content');
select pg_temp.rejects($$insert into public.contributor_applications(user_id,name,contact,contributor_type,description,rights_information,status,reviewed_by,reviewed_at) values (auth.uid(),'Fake','x@example.invalid','author','x','x','approved',auth.uid(),now())$$,'42501','Reader cannot submit approved application');
update public.contributor_applications set status='approved', reviewed_by=auth.uid(), reviewed_at=now();
select is((select status::text from public.contributor_applications), 'pending', 'Reader cannot approve own application');
update public.books set status='draft';
select is((select count(*)::int from public.books), 2, 'Reader cannot change catalogue');
update public.profiles set display_name='Reader A';
select is((select display_name from public.profiles), 'Reader A', 'Safe own profile edit works');
select pg_temp.rejects($$update public.profiles set id='a0000000-0000-4000-8000-000000000002'$$,'42501','Profile identity is not editable');

select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.loans where user_id='a0000000-0000-4000-8000-000000000001'), 0, 'Reader B cannot see A loan');
select is((select count(*)::int from public.payments), 1, 'Reader B own payments work');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select is((select private.is_admin()), true, 'Protected membership grants admin');
select is((select count(*)::int from public.books), 3, 'Admin sees drafts');
select is((select count(*)::int from public.loans), 2, 'Admin sees loans');
select is((select count(*)::int from public.payments), 2, 'Admin sees payments');
select is((select count(*)::int from public.book_licenses), 3, 'Admin sees rights records');
select is((select count(*)::int from storage.objects where name='test-private.json'), 1, 'Admin sees private object');
select lives_ok($$update public.books set description='Admin edited demo' where id='20000000-0000-4000-8000-000000000003'$$, 'Admin can manage draft metadata');
select lives_ok($$update public.contributor_applications set status='approved', reviewed_by=auth.uid(), reviewed_at=now()$$, 'Admin can review applications');
select pg_temp.rejects($$update public.payments set status='confirmed'$$,'42501','Browser admin cannot confirm payments');
select pg_temp.rejects($$update public.loans set status='active'$$,'42501','Browser admin cannot activate loans');
select pg_temp.rejects($$insert into public.user_roles(user_id,role) values ('a0000000-0000-4000-8000-000000000001','admin')$$,'42501','Browser admin cannot mint roles');
reset role;

select pg_temp.rejects($$update public.borrowing_plans set price_units=0$$,'23514','Zero price rejected');
select pg_temp.rejects($$update public.borrowing_plans set duration_days=4$$,'23514','Unsupported duration rejected');
select pg_temp.rejects($$update public.borrowing_plans set chain_id=1$$,'23514','Wrong network rejected');
select pg_temp.rejects($$update public.borrowing_plans set token='USDC'$$,'23514','Wrong token rejected');
select pg_temp.rejects($$update public.borrowing_plans set token_contract='0x1111111111111111111111111111111111111111'$$,'23514','Wrong token contract rejected');
select pg_temp.rejects($$update public.books set ownership='contributor',contributor_id=null$$,'23514','Contributor ownership requires contributor');
select pg_temp.rejects($$insert into public.books(title,author,description,category,status) values ('Unlicensed','Nobody','','Demo','published')$$,'23514','Publication requires rights and asset mapping');
select pg_temp.rejects($$insert into public.book_assets(book_id,object_path,chapter_number,byte_size,sha256) values (gen_random_uuid(),'orphan.json',1,20,repeat('a',64))$$,'23503','Orphan asset rejected');
select pg_temp.rejects($$update public.book_assets set mime_type='text/html'$$,'23514','HTML asset type rejected');
select pg_temp.rejects($$update public.book_assets set object_path='../escape.json'$$,'23514','Traversal asset path rejected');
select pg_temp.rejects($$update public.book_assets set byte_size=1048577$$,'23514','Oversized chapter metadata rejected');
select pg_temp.rejects($$insert into public.loans(user_id,book_id,borrowing_plan_id,duration_days) values ('a0000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',3)$$,'23503','Plan must belong to selected book');
select pg_temp.rejects($$insert into public.loans(user_id,book_id,borrowing_plan_id,duration_days) select user_id,book_id,borrowing_plan_id,duration_days from public.loans limit 1$$,'23505','Duplicate open loan rejected');
select pg_temp.rejects($$update public.loans set duration_days=14$$,'23514','Loan duration snapshot immutable');
select lives_ok($$update public.borrowing_plans set price_units=3500000 where id='30000000-0000-4000-8000-000000000002'$$,'Future plan price can change');
select is((select gross_amount from public.payments limit 1), 2000000::bigint, 'Existing quote unaffected by plan edit');
select pg_temp.rejects($$update public.payments set gross_amount=1,platform_share=1$$,'23514','Privileged quote edits also rejected');
select pg_temp.rejects($$update public.payments set recipient='0x4444444444444444444444444444444444444444'$$,'23514','Recipient snapshot immutable');
select pg_temp.rejects($$update public.loans set status='active',started_at=now(),expires_at=now()+interval '7 days'; set constraints all immediate$$,'23514','Activation without confirmed payment rolls back');
select is((select count(*)::int from public.loans where status='active'), 0, 'Failed activation transaction leaves no active loan');

update public.payments set tx_hash='0x'||repeat('a',64),status='submitted',submitted_at=now() where id='c0000000-0000-4000-8000-000000000001';
select pg_temp.rejects($$update public.payments set tx_hash='0x'||repeat('A',64),status='submitted',submitted_at=now() where id='c0000000-0000-4000-8000-000000000002'$$,'23505','Mixed-case duplicate chain/hash rejected');
select pg_temp.rejects($$update public.payments set tx_hash=null where id='c0000000-0000-4000-8000-000000000001'$$,'23514','Claimed hash cannot be cleared');
update public.payments set status='verifying' where id='c0000000-0000-4000-8000-000000000001';
select lives_ok($$update public.payments set last_checked_at=now() where status='verifying'$$,'Verification timeout can remain unresolved');
select is((select status::text from public.payments where id='c0000000-0000-4000-8000-000000000001'),'verifying','Timeout is not automatic failure');
select pg_temp.rejects($$update public.payments set status='confirmed',verified_at=now() where status='verifying'$$,'23514','Confirmation requires complete evidence fields');
-- Fixture only: database does not claim to verify chain receipts in Phase 2.
update public.payments set status='confirmed',verified_at=now(),block_number=101,block_hash='0x'||repeat('b',64),block_timestamp=now()
  where id='c0000000-0000-4000-8000-000000000001';
update public.loans set status='active',started_at=now(),expires_at=now()+interval '7 days' where id='b0000000-0000-4000-8000-000000000001';
set constraints all immediate;
select is((select count(*)::int from public.loans where status='active'), 1, 'Matching confirmation and activation commit together');
select pg_temp.rejects($$update public.loans set started_at=started_at+interval '1 hour',expires_at=expires_at+interval '1 hour' where status='active'$$,'23514','Retry cannot extend active loan');
select pg_temp.rejects($$update public.payments set block_number=102 where status='confirmed'$$,'23514','Completed payment evidence immutable');
select pg_temp.rejects($$update public.loans set status='expired' where status='active'$$,'23514','Cannot mark future loan expired');
select lives_ok($$update public.loans set status='returned',returned_at=now() where status='active'$$,'Valid early return retains payment history');
select pg_temp.rejects($$update public.loans set status='active',returned_at=null where status='returned'$$,'23514','Returned loan cannot reopen');
select is((select count(*)::int from public.payments where status='confirmed'),1,'Return does not refund or erase payment');

select * from finish();
rollback;
