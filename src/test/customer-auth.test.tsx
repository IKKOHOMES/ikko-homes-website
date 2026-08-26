import { act, render } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { expect, test, vi } from 'vitest';

const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));

vi.mock('../lib/supabase', () => ({
  getCustomerSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

import { CustomerAuthProvider, useCustomerAuth } from '../context/CustomerAuthContext';

function SignUpHarness({ onReady }: { onReady: (signUp: ReturnType<typeof useCustomerAuth>['signUp']) => void }) {
  const { signUp: register } = useCustomerAuth();
  useEffect(() => onReady(register), [onReady, register]);
  return null;
}

function Provider({ children }: { children: ReactNode }) {
  return <CustomerAuthProvider>{children}</CustomerAuthProvider>;
}

test('marks a new frontend registration as a customer account', async () => {
  let register: ReturnType<typeof useCustomerAuth>['signUp'] | undefined;
  render(<SignUpHarness onReady={(value) => { register = value; }} />, { wrapper: Provider });

  await act(async () => { await register?.({ firstName: 'Ari', lastName: 'Lee', email: 'ari@example.com', password: 'Password123' }); });

  expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
    options: { data: { first_name: 'Ari', last_name: 'Lee', account_type: 'customer' } },
  }));
});
