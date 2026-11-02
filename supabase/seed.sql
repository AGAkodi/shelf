-- Local/development demo data only. No users, roles, loans or payments are seeded.
begin;
insert into public.contributors(id, name, contact, contributor_type) values
  ('10000000-0000-4000-8000-000000000001', 'Shelf Demo Studio (fictional)', 'demo@shelf.invalid', 'publisher');
insert into public.books(id, title, author, description, category, public_preview, ownership, contributor_id) values
  ('20000000-0000-4000-8000-000000000001', 'The Quiet Orbit', 'Shelf Original Demo',
    'An original short story about finding wonder close to home. Development demo content.', 'Fiction',
    'Mara opened the observatory before dawn. The city below was still dark.', 'platform', null),
  ('20000000-0000-4000-8000-000000000002', 'A Small Garden of Time', 'Shelf Demo Studio',
    'An original reflection on observation and small daily rituals. Development demo content.', 'Mindful Living',
    'Begin with a pot you can lift and a patch of light you can visit.', 'contributor', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', 'The Paper City', 'Shelf Original Demo',
    'An original unfinished miniature about maps and change. Draft development demo.', 'Short Stories',
    'The mapmaker drew a bridge where the river had once been narrow.', 'platform', null);
insert into public.book_licenses(book_id, rights_holder, rights_evidence, distribution_permitted, reviewed_at, review_notes)
  select id, 'Shelf original demo content',
    'Original text created for Shelf development. See supabase/seed-content/README.md. No commercial prototype content is included.',
    true, now(), 'Development seed reviewed by privileged seed operator; not a production license.' from public.books;
-- Byte lengths and SHA-256 values describe the exact UTF-8 chapter files in seed-content.
insert into public.book_assets(book_id, object_path, chapter_number, byte_size, sha256) values
  ('20000000-0000-4000-8000-000000000001', 'quiet-orbit/chapter-1.json', 1, 551, 'c50d2f055168ce2f4fabc0a5b4fba2f78334a48983808bf9c2b7e7b37e71560f'),
  ('20000000-0000-4000-8000-000000000002', 'small-garden/chapter-1.json', 1, 550, 'c27d6f5a18334447f681a7d217b3c037c8822b00351254c4cc7c0e2ea1f5a30e'),
  ('20000000-0000-4000-8000-000000000003', 'paper-city/chapter-1.json', 1, 319, 'a8a270e125d3cd3608368dea233b0d1c5c93b323b7495b8fcf33ec2355a5a2a8');
insert into public.borrowing_plans(id, book_id, duration_days, price_units, enabled) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 3, 1000000, true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 7, 2000000, true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 14, 3000000, true),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 3, 1500000, true),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 7, 2500000, true),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 14, 4000000, false),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', 3, 500000, true);
update public.books set status = 'published' where id in
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
commit;
