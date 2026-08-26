import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import '../styles/global.css';

const mockListPublishedBlogPosts = vi.hoisted(() => vi.fn());
vi.mock('../lib/public-blogs', () => ({ listPublishedBlogPosts: mockListPublishedBlogPosts }));

beforeEach(() => { mockListPublishedBlogPosts.mockResolvedValue([]); });

test('presents the IKKO Homes story, supply process, and editorial media areas', () => {
  window.history.pushState({}, '', '/about');
  render(<App />);

  expect(screen.getByRole('img', { name: /IKKO Homes interior overview/i })).toBeInTheDocument();
  expect(screen.getByText(/IKKO HOMES offers a complete, one-stop interior solution/i)).toBeInTheDocument();
  expect(screen.getByText('Modern Japanese, Japandi and Organic Modern').tagName).toBe('STRONG');

  const process = screen.getByRole('region', { name: /our process/i });
  expect(within(process).getByRole('img', { name: /Design to styling process flow/i })).toBeInTheDocument();
  expect(process.querySelectorAll('.about-process__step')).toHaveLength(4);
  expect(process.querySelectorAll('.about-process__arrow')).toHaveLength(3);
  expect([...process.querySelectorAll('.about-process__arrow')].every((arrow) => arrow.textContent === '>')).toBe(true);
  expect(within(process).getAllByRole('listitem')).toHaveLength(4);
  expect(within(process).getByRole('heading', { name: 'Design' })).toBeInTheDocument();
  expect(within(process).getByRole('heading', { name: 'Finishing touches' })).toBeInTheDocument();

  const media = screen.getByRole('region', { name: /blogs and media/i });
  expect(within(media).queryByText(/Share a studio article here/i)).not.toBeInTheDocument();
  expect(within(media).queryByText(/Instagram/i)).not.toBeInTheDocument();
  expect(within(media).queryByText(/Facebook/i)).not.toBeInTheDocument();
  expect(within(media).queryByText(/rednote/i)).not.toBeInTheDocument();
});

test('renders published articles in the existing blogs and media area', async () => {
  mockListPublishedBlogPosts.mockResolvedValue([{ id: 'post-1', title: 'A quiet kitchen', slug: 'quiet-kitchen', excerpt: 'Material notes from the studio.', coverImageUrl: 'https://cdn.example/article.jpg', publicationDate: '2026-08-20T00:00:00.000Z' }]);
  window.history.pushState({}, '', '/about');
  render(<App />);

  expect(await screen.findByText('A quiet kitchen')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'A quiet kitchen' })).toHaveAttribute('src', 'https://cdn.example/article.jpg');
  expect(screen.queryByText(/Scenes from our studio/i)).not.toBeInTheDocument();
});

test('opens a media card in a new tab using its managed destination URL and post type', async () => {
  mockListPublishedBlogPosts.mockResolvedValue([{
    id: 'post-1', title: 'A quiet kitchen', slug: 'quiet-kitchen', excerpt: 'Material notes from the studio.',
    coverImageUrl: 'https://cdn.example/article.jpg', publicationDate: '2026-08-20T00:00:00.000Z',
    postType: 'rednote', destinationUrl: 'https://www.xiaohongshu.com/explore/quiet-kitchen',
  }]);
  window.history.pushState({}, '', '/about');
  render(<App />);

  const card = await screen.findByRole('link', { name: /a quiet kitchen/i });
  expect(card).toHaveAttribute('href', 'https://www.xiaohongshu.com/explore/quiet-kitchen');
  expect(card).toHaveAttribute('target', '_blank');
  expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByText('Rednote')).toBeInTheDocument();
});
