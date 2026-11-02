import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { localClients, root } from './lib/local-supabase.mjs'

const { server } = localClients()
const { data, error } = await server.from('book_assets').select('object_path,byte_size,sha256')
if (error) throw new Error(error.message)
assert.equal(data.length, 3, 'Storage seeding expects the three local demo assets after reset')
for (const asset of data) {
  assert.match(asset.object_path, /^(quiet-orbit|small-garden|paper-city)\/chapter-1\.json$/)
  const bytes = await readFile(join(root, 'supabase/seed-content', asset.object_path))
  assert.equal(bytes.length, asset.byte_size, 'Asset byte length matches database')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, 'Asset digest matches database')
  const chapter = JSON.parse(bytes.toString('utf8'))
  assert.equal(chapter.format, 'chapter-text-v1')
  assert.ok(chapter.paragraphs.every((text) => typeof text === 'string' && !/[<>]/.test(text)))
  const result = await server.storage.from('protected-books').upload(asset.object_path, bytes, { contentType: 'application/json', upsert: true })
  if (result.error) throw new Error(result.error.message)
}
console.log('Uploaded and validated 3 original demo chapters in private storage.')
