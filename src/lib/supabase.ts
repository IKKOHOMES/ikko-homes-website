import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseEnvironment = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string>>;

type AuthAudience = 'public' | 'admin' | 'customer';

const clients: Partial<Record<AuthAudience, SupabaseClient>> = {};

const authStorageKeys = {
  admin: 'ikko-homes-admin-auth',
  customer: 'ikko-homes-customer-auth',
} as const;

function environmentValues(environment: SupabaseEnvironment = import.meta.env) {
  return {
    url: environment.VITE_SUPABASE_URL?.trim() ?? '',
    key: environment.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  };
}

export function hasSupabaseConfiguration(environment?: SupabaseEnvironment) {
  const { url, key } = environmentValues(environment);
  return Boolean(url && key);
}

export function getAuthStorageKey(audience: AuthAudience) {
  return audience === 'public' ? undefined : authStorageKeys[audience];
}

function getClient(audience: AuthAudience): SupabaseClient {
  const existingClient = clients[audience];
  if (existingClient) return existingClient;

  const { url, key } = environmentValues();
  if (!url || !key) throw new Error('Supabase is not configured.');

  const storageKey = getAuthStorageKey(audience);
  const client = createClient(
    url,
    key,
    storageKey
      ? { auth: { storageKey, ...(audience === 'admin' ? { persistSession: false } : {}) } }
      : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  clients[audience] = client;
  return client;
}

export function getSupabaseClient(): SupabaseClient {
  return getClient('public');
}

export function getAdminSupabaseClient(): SupabaseClient {
  return getClient('admin');
}

export function getCustomerSupabaseClient(): SupabaseClient {
  return getClient('customer');
}
