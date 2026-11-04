import { expect, it } from 'vitest';
import { allowedOrigins } from '../../supabase/functions/_shared/origins';
it('allows exact configured LAN origins only for local Supabase', () => {
  expect(allowedOrigins(true, 'http://192.168.1.10:5173')).toContain('http://192.168.1.10:5173');
  expect(allowedOrigins(false, 'http://192.168.1.10:5173')).toEqual([]);
  expect(allowedOrigins(true, 'http://example.com,http://10.evil.com,https://example.com/path')).toEqual(['http://127.0.0.1:5173', 'http://localhost:5173']);
  expect(allowedOrigins(false, 'https://shelf.example')).toEqual(['https://shelf.example']);
});
