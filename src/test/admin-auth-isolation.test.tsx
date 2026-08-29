import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

const adminClient = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'customer-user-1' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'customer' }, error: null }) }) }) })),
};
const publicClient = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'customer-user-1' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'customer' }, error: null }) }) }) })),
};

vi.mock('../lib/supabase', () => ({
  getAdminSupabaseClient: () => adminClient,
  getSupabaseClient: () => publicClient,
}));

import { AdminAuthProvider } from '../context/AdminAuthContext';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';

test('rejects a customer account from the administrator login session', async () => {
  render(<MemoryRouter><AdminAuthProvider><AdminLoginPage /></AdminAuthProvider></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  expect(adminClient.from).toHaveBeenCalledWith('profiles');
  expect(publicClient.from).not.toHaveBeenCalledWith('profiles');
});
