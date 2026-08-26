import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import '../styles/global.css';

const mockGetPublicProjectBySlug = vi.hoisted(() => vi.fn());
vi.mock('../lib/public-projects', () => ({ getPublicProjectBySlug: mockGetPublicProjectBySlug, listPublicProjects: vi.fn(async () => []) }));

beforeEach(() => { mockGetPublicProjectBySlug.mockResolvedValue(null); });

test('does not retain static project details when a cloud project is unavailable', async () => {
  window.history.pushState({}, '', '/projects/bondi-residence');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Project not found.' })).toBeInTheDocument();
});

test('shows the not-found editorial page for an unknown project', async () => {
  window.history.pushState({}, '', '/projects/unknown-project');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Project not found.' })).toBeInTheDocument();
});

test('renders saved cloud gallery images when an active project is available', async () => {
  mockGetPublicProjectBySlug.mockResolvedValue({ id: 'project-1', slug: 'bondi-residence', name: 'Bondi Residence', location: 'Sydney, NSW', style: 'Japandi', introduction: 'Cloud project story.', displayOrder: 1, coverImageUrl: 'https://cdn.example/cover.jpg', gallery: ['https://cdn.example/living.jpg'] });
  window.history.pushState({}, '', '/projects/bondi-residence');
  render(<App />);

  expect(await screen.findByRole('img', { name: 'Bondi Residence cover image' })).toHaveAttribute('src', 'https://cdn.example/cover.jpg');
  expect(await screen.findByRole('img', { name: 'Bondi Residence gallery image 1' })).toHaveAttribute('src', 'https://cdn.example/living.jpg');
  expect(screen.getByText('Cloud project story.')).toBeInTheDocument();
});
