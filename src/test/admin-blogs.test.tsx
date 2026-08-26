import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { AdminBlogsPage } from '../pages/admin/AdminBlogsPage';

vi.mock('../lib/admin-api', () => ({
  archiveBlogPost: vi.fn(),
  deleteBlogPost: vi.fn(),
  listManagedBlogPosts: vi.fn(async () => []),
  publicAssetUrl: vi.fn(() => null),
  saveBlogPost: vi.fn(),
  uploadBlogImage: vi.fn(),
}));

test('updates an article slug when its title changes', async () => {
  const user = userEvent.setup();
  render(<AdminBlogsPage />);

  await user.click(await screen.findByRole('button', { name: 'Add article' }));
  await user.type(screen.getByLabelText('Title'), 'Material Notes: Stone & Timber');

  expect(screen.getByLabelText('URL slug')).toHaveValue('material-notes-stone-timber');
  expect(screen.getByLabelText('URL slug')).toHaveAttribute('readonly');
});

test('lets an administrator select a post type and destination URL', async () => {
  const user = userEvent.setup();
  render(<AdminBlogsPage />);

  await user.click(await screen.findByRole('button', { name: 'Add article' }));

  expect(screen.getByLabelText('Post type')).toHaveValue('journal');
  expect(screen.getByRole('option', { name: 'Journal' })).toHaveValue('journal');
  expect(screen.getByRole('option', { name: 'Rednote' })).toHaveValue('rednote');
  expect(screen.getByRole('option', { name: 'Facebook' })).toHaveValue('facebook');
  expect(screen.getByRole('option', { name: 'YouTube' })).toHaveValue('youtube');
  expect(screen.getByRole('option', { name: 'Instagram' })).toHaveValue('instagram');
  expect(screen.getByLabelText('Destination URL')).toHaveValue('');
});
