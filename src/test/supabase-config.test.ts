import { expect, test } from 'vitest';
import { getAuthStorageKey, hasSupabaseConfiguration } from '../lib/supabase';

test('reports missing Supabase configuration without constructing a client', () => {
  expect(hasSupabaseConfiguration({})).toBe(false);
});

test('uses independent browser storage keys for administrator and customer sessions', () => {
  expect(getAuthStorageKey('admin')).toBe('ikko-homes-admin-auth');
  expect(getAuthStorageKey('customer')).toBe('ikko-homes-customer-auth');
  expect(getAuthStorageKey('public')).toBeUndefined();
});
