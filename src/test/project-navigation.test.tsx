import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import '../styles/global.css';

const mockListPublicProjects = vi.hoisted(() => vi.fn());

vi.mock('../lib/public-projects', () => ({
  listPublicProjects: mockListPublicProjects,
  getPublicProjectBySlug: vi.fn(async () => null),
}));

beforeEach(() => {
  mockListPublicProjects.mockResolvedValue([]);
});

test('does not retain static featured project cards when cloud projects are empty', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);

  await waitFor(() => expect(screen.queryByRole('link', { name: /bondi residence/i })).not.toBeInTheDocument());
});

test('keeps a clear visual gap between featured projects and the footer', async () => {
  mockListPublicProjects.mockResolvedValue([{
    id: 'project-1', slug: 'sample-project', name: 'Sample Project', location: 'Melbourne, VIC',
    imageTone: 'warm', coverImageUrl: null,
  }]);
  window.history.pushState({}, '', '/');
  render(<App />);

  const section = (await screen.findByRole('heading', { name: 'Inspired spaces. Real homes.' })).closest<HTMLElement>('.featured-projects');
  expect(section).not.toBeNull();
  expect(getComputedStyle(section!).paddingBottom).toBe('5rem');
});

test('shows an empty projects directory rather than static cards', async () => {
  window.history.pushState({}, '', '/projects');
  render(<App />);

  expect(await screen.findByText('No projects are currently published.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /coastal house/i })).not.toBeInTheDocument();
});
