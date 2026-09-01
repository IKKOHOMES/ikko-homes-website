import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentActions } from '../components/admin/DocumentActions';
import { emailOrderDocument } from '../lib/admin-document';

vi.mock('../lib/admin-document', () => ({
  downloadOrderDocument: vi.fn(),
  emailOrderDocument: vi.fn(),
}));

test('reports a document email failure without exposing provider details', async () => {
  vi.mocked(emailOrderDocument).mockRejectedValueOnce(new Error('provider error'));
  render(<DocumentActions documentType="quote" documentId="quote-1" recipientEmail="client@example.com" />);
  await userEvent.click(screen.getByRole('button', { name: 'Email Quote' }));
  expect(await screen.findByText('Unable to email the document.')).toBeInTheDocument();
});
test('uses primary action styling for quote document buttons', () => {
  render(<DocumentActions documentType="quote" documentId="quote-1" recipientEmail="client@example.com" />);

  expect(screen.getByRole('button', { name: 'Download PDF' })).toHaveClass('button');
  expect(screen.getByRole('button', { name: 'Email Quote' })).toHaveClass('button');
});
