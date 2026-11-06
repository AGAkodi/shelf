import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { localClients, sql } from '../../scripts/lib/local-supabase.mjs'

// Real local Auth, PostgREST and Storage integration, with ephemeral test users.
// Never accepts remote credentials or a remote URL.
test('local Auth identities, database isolation and actual Storage authorization', async (t) => {
  const { anon, server, reader, url, anonKey } = localClients()
  const users = []
  const uploaded = []
  const bookId = '20000000-0000-4000-8000-000000000001'
  const planId = '30000000-0000-4000-8000-000000000002'
  const privatePath = 'quiet-orbit/chapter-1.json'
  const must = (result) => { assert.equal(result.error, null, result.error?.message); return result.data }
  try {
    for (const label of ['a', 'b', 'admin']) {
      const password = randomBytes(32).toString('base64url')
      const email = `shelf-test-${label}-${randomUUID()}@example.invalid`
      const created = must(await server.auth.admin.createUser({ email, password, email_confirm: true,
        user_metadata: { role: 'admin', wallet_address: '0x1111111111111111111111111111111111111111' } }))
      const client = reader()
      users.push({ id: created.user.id, client })
      must(await client.auth.signInWithPassword({ email, password }))
    }
    const [a, b, admin] = users
    for (const user of users) assert.match(user.id, /^[0-9a-f-]{36}$/)
    // Explicit local privileged operator action; no bootstrap function is exposed to clients.
    sql(`insert into public.user_roles(user_id,role) values ('${admin.id}','admin');`)
    for (const user of [a, b]) {
      const loan = must(await server.from('loans').insert({ user_id: user.id, book_id: bookId, borrowing_plan_id: planId, duration_days: 7 }).select().single())
      must(await server.from('payments').insert({ loan_id: loan.id, user_id: user.id, gross_amount: 2000000,
        ownership: 'platform', contributor_share: 0, platform_share: 2000000,
        recipient: '0x1111111111111111111111111111111111111111', quote_block_number: 100, idempotency_key: randomUUID() }))
      must(await user.client.from('contributor_applications').insert({ user_id: user.id, name: 'Test applicant',
        contact: 'test@example.invalid', contributor_type: 'author', description: 'Original demo', rights_information: 'Original work' }))
    }

    await t.test('anonymous catalogue excludes drafts and disabled plans', async () => {
      const books = must(await anon.from('books').select('*'))
      assert.equal(books.length, 2)
      assert.ok(books.every((book) => book.status === 'published' && !('object_path' in book)))
      assert.equal(must(await anon.from('borrowing_plans').select('*')).length, 5)
      assert.ok((await anon.from('book_assets').select('*')).error)
    })
    await t.test('real reader sessions see only their own private records', async () => {
      for (const user of [a, b]) for (const table of ['loans', 'payments', 'contributor_applications']) {
        const rows = must(await user.client.from(table).select('*'))
        assert.equal(rows.length, 1)
        assert.equal(rows[0].user_id, user.id)
      }
      assert.equal(must(await a.client.from('profiles').select('*')).length, 1)
      assert.equal(must(await a.client.from('loans').select('*').eq('user_id', b.id)).length, 0)
      assert.equal(must(await a.client.from('payments').select('*').eq('user_id', b.id)).length, 0)
      assert.equal(must(await a.client.from('contributor_applications').select('*').eq('user_id', b.id)).length, 0)
    })
    await t.test('editable Auth metadata grants neither wallet ownership nor admin', async () => {
      assert.deepEqual(must(await a.client.from('user_roles').select('role')).map((row) => row.role), ['reader'])
      assert.ok((await a.client.from('user_roles').insert({ user_id: a.id, role: 'admin' })).error)
      assert.ok((await a.client.from('profiles').update({ wallet_address: 'forged' }).eq('id', a.id)).error)
      assert.ok((await a.client.from('books').insert({ title: 'Forged', author: 'Reader', description: '', category: 'Fake' })).error)
    })
    await t.test('reader cannot write financial status, quote or revenue', async () => {
      for (const patch of [{ status: 'confirmed' }, { gross_amount: 1 }, { contributor_share: 2000000 }, { tx_hash: '0x' + 'a'.repeat(64) }]) {
        assert.ok((await a.client.from('payments').update(patch).eq('user_id', a.id)).error)
      }
      assert.ok((await a.client.from('loans').update({ status: 'active' }).eq('user_id', a.id)).error)
      assert.ok((await a.client.from('loans').insert({ user_id: a.id, book_id: bookId, borrowing_plan_id: planId, duration_days: 7 })).error)
      assert.equal(must(await a.client.from('payments').select('status').single()).status, 'pending')
    })
    await t.test('reader cannot approve an application or create contributor identity', async () => {
      const changed = must(await a.client.from('contributor_applications').update({ status: 'approved', reviewed_by: a.id, reviewed_at: new Date().toISOString() }).eq('user_id', a.id).select())
      assert.equal(changed.length, 0)
      assert.ok((await a.client.from('contributors').insert({ user_id: a.id, name: 'Fake', contact: 'x@example.invalid', contributor_type: 'author' })).error)
    })
    await t.test('admin visibility works; financial writes still require backend', async () => {
      const tampered = await b.client.from('contributor_applications').insert({
        user_id:b.id, name:'Forged',contact:'test@example.invalid',contributor_type:'author',
        description:'test',rights_information:'test',created_at:'2099-01-01T00:00:00Z'
      });
      assert.equal(tampered.error?.code,'42501');
      assert.equal(must(await admin.client.from('books').select('*')).length, 3)
      assert.equal(must(await admin.client.from('loans').select('*').in('user_id',[a.id,b.id])).length, 2)
      assert.equal(must(await admin.client.from('payments').select('*').in('user_id',[a.id,b.id])).length, 2)
      assert.equal(must(await admin.client.from('book_assets').select('*')).length, 3)
      const changed = must(await admin.client.from('contributor_applications').update({ status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq('user_id', a.id).select())
      assert.equal(changed.length, 1)
      assert.equal(must(await admin.client.from('contributors').select('application_id').eq('user_id',a.id).single()).application_id,changed[0].id)
      const rejected = must(await admin.client.from('contributor_applications').update({status:'rejected'}).eq('user_id',b.id).select().single())
      assert.equal(rejected.reviewed_by,admin.id)
      assert.ok((await admin.client.from('contributor_applications').update({status:'approved'}).eq('id',rejected.id)).error)
      assert.deepEqual(must(await a.client.from('user_roles').select('role')).map((row) => row.role), ['reader'])
      assert.ok((await admin.client.from('payments').update({ status: 'confirmed' }).eq('user_id', a.id)).error)
    })
    await t.test('private object exists and server can download its real bytes', async () => {
      const blob = must(await server.storage.from('protected-books').download(privatePath))
      const chapter = JSON.parse(await blob.text())
      assert.equal(chapter.format, 'chapter-text-v1')
      assert.ok(chapter.paragraphs.length > 0)
    })
    await t.test('anonymous and reader direct private downloads and signing fail', async () => {
      for (const client of [anon, a.client, b.client]) {
        assert.ok((await client.storage.from('protected-books').download(privatePath)).error)
        assert.ok((await client.storage.from('protected-books').createSignedUrl(privatePath, 3600)).error)
        assert.equal(must(await client.storage.from('protected-books').list('quiet-orbit')).length, 0)
      }
      const response = await fetch(`${url}/storage/v1/object/public/protected-books/${privatePath}`)
      assert.ok(response.status >= 400, 'Public object endpoint must deny private bucket')
    })
    await t.test('readers cannot upload covers or chapters', async () => {
      for (const bucket of ['covers', 'protected-books']) {
        assert.ok((await a.client.storage.from(bucket).upload('test-forged.json', '{}', { contentType: 'application/json' })).error)
      }
    })
    await t.test('admin uploads private JSON; active HTML and excess size rejected', async () => {
      const path = `tests/${randomUUID()}.json`
      must(await admin.client.storage.from('protected-books').upload(path, '{"format":"chapter-text-v1","paragraphs":["test"]}', { contentType: 'application/json' }))
      uploaded.push(['protected-books', path])
      assert.ok((await a.client.storage.from('protected-books').download(path)).error)
      assert.ok((await admin.client.storage.from('protected-books').upload(`tests/${randomUUID()}.html`, '<script>alert(1)</script>', { contentType: 'text/html' })).error)
      assert.ok((await admin.client.storage.from('protected-books').upload(`tests/${randomUUID()}.json`, new Uint8Array(1048577), { contentType: 'application/json' })).error)
    })
    await t.test('public cover bytes are readable and bucket cannot be made public by reader', async () => {
      const path = `tests/${randomUUID()}.png`
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
      must(await admin.client.storage.from('covers').upload(path, png, { contentType: 'image/png' }))
      uploaded.push(['covers', path])
      const response = await fetch(`${url}/storage/v1/object/public/covers/${path}`)
      assert.equal(response.status, 200)
      assert.ok((await a.client.storage.updateBucket('protected-books', { public: true })).error)
      assert.equal(must(await server.storage.getBucket('protected-books')).public, false)
    })
    await t.test('Web3 provider stays disabled', async () => {
      const response = await fetch(`${url}/auth/v1/token?grant_type=web3`, { method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: 'ethereum', message: 'disabled-test', signature: '0x00' }) })
      assert.equal(response.status, 422)
      assert.equal((await response.json()).error_code, 'web3_provider_disabled')
    })
  } finally {
    for (const [bucket, path] of uploaded) must(await server.storage.from(bucket).remove([path]))
    if (users.length) {
      const ids = users.map((user) => user.id)
      must(await server.from('payments').delete().in('user_id', ids))
      must(await server.from('loans').delete().in('user_id', ids))
      must(await server.from('contributors').delete().in('user_id',ids))
      must(await server.from('contributor_applications').delete().in('user_id', ids))
      for (const user of users) must(await server.auth.admin.deleteUser(user.id))
    }
  }
})
