import { beforeEach, expect, test, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn(() => ({})));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

beforeEach(() => {
  createClient.mockClear();
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
});

test('creates the administrator client without a persistent browser session', async () => {
  const { getAdminSupabaseClient } = await import('../lib/supabase');

  getAdminSupabaseClient();

  expect(createClient).toHaveBeenCalledWith(
    'https://example.supabase.co',
    'public-anon-key',
    { auth: { persistSession: false, storageKey: 'ikko-homes-admin-auth' } },
  );
});
