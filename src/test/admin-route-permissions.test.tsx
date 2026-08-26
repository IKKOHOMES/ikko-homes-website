import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => ({ loading: false, session: { user: { id: 'customer-user-1' } }, isAdmin: false, signOut: vi.fn() }),
}));

import { AdminRoute } from '../components/admin/AdminRoute';

function AccountLoginDestination() {
  const location = useLocation();
  return <p>{location.pathname}{location.search}</p>;
}

test('sends a non-administrator to the shared administrator sign in', () => {
  render(<MemoryRouter initialEntries={['/admin/dashboard']}><Routes><Route path="/admin/dashboard" element={<AdminRoute><p>Private admin content</p></AdminRoute>} /><Route path="/account" element={<AccountLoginDestination />} /></Routes></MemoryRouter>);

  expect(screen.getByText('/account?mode=admin')).toBeInTheDocument();
  expect(screen.queryByText('Private admin content')).not.toBeInTheDocument();
});
