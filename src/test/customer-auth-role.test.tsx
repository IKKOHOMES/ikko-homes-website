import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

const customerSession = { user: { id: 'internal-user-1', email: 'staff@ikkohomes.com.au' } };
const customerClient = {
  auth: {
    getSession: async () => ({ data: { session: customerSession } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => table === 'profiles' ? { data: { id: 'internal-user-1' }, error: null } : { data: null, error: null } }),
    }),
  })),
};

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } }),
  getCustomerSupabaseClient: () => customerClient,
}));

import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { CustomerAuthPage } from '../pages/CustomerAuthPage';

test('rejects an internal administrator from the customer account area', async () => {
  render(<MemoryRouter><CustomerAuthProvider><CustomerAuthPage /></CustomerAuthProvider></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  expect(screen.queryByRole('heading', { name: 'My orders' })).not.toBeInTheDocument();
});
