import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cli, root } from './lib/local-supabase.mjs'

const types = cli(['gen', 'types', 'typescript', '--schema', 'public'])
if (!types.includes('export type Database')) throw new Error('CLI did not produce database types')
writeFileSync(join(root, 'src/lib/supabase/database.types.ts'), types)
console.log('Generated public database types from local PostgreSQL.')
