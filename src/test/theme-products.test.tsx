import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../App';
import { PaletteRow } from '../components/product/PaletteRow';
import '../styles/global.css';
import '../styles/image-frames.css';

const mockListPublicCatalogue = vi.hoisted(() => vi.fn());
const mockGetPublicStyleRangeBySlug = vi.hoisted(() => vi.fn());
const mockListPublicHomeThemeBlocks = vi.hoisted(() => vi.fn());

vi.mock('../lib/public-content', () => ({ listPublicCatalogue: mockListPublicCatalogue }));
vi.mock('../lib/public-style-ranges', () => ({
  getPublicStyleRangeBySlug: mockGetPublicStyleRangeBySlug,
  listPublicStyleRanges: vi.fn(async () => []),
}));
vi.mock('../lib/public-home-theme-blocks', () => ({ listPublicHomeThemeBlocks: mockListPublicHomeThemeBlocks }));

const japaneseModernRange = {
  id: 'japanese-modern',
  slug: 'japanese-modern',
  name: 'Japanese Modern',
  eyebrow: 'Japanese Modern',
  headline: 'Quietly considered living.',
  description: 'Clean lines and natural materials for everyday living.',
  heroImageUrl: 'https://example.com/japanese-modern-hero.jpg',
  roomImageUrl: 'https://example.com/japanese-modern-room.jpg',
  palette: [
    { id: 'stone', name: 'Stone', colour: '#ECE7DF', imageUrl: 'https://assets.example/stone.jpg', displayOrder: 1 },
    { id: 'timber', name: 'Timber', colour: '#9A6A45', imageUrl: null, displayOrder: 2 },
  ],
  displayOrder: 1,
  isActive: true,
};

beforeEach(() => {
  mockListPublicCatalogue.mockResolvedValue({
    categories: [
      { id: 'furniture', name: 'Furniture', parentId: null, depth: 1, displayOrder: 1, isActive: true },
      { id: 'living', name: 'Living', parentId: 'furniture', depth: 2, displayOrder: 1, isActive: true },
      { id: 'sofa', name: 'Sofa', parentId: 'living', depth: 3, displayOrder: 1, isActive: true },
      { id: 'cabinets', name: 'Cabinets', parentId: null, depth: 1, displayOrder: 2, isActive: true },
      { id: 'cabinetry-kitchen', name: 'Kitchen', parentId: 'cabinets', depth: 2, displayOrder: 1, isActive: true },
      { id: 'cabinetry-units', name: 'Cabinet units', parentId: 'cabinetry-kitchen', depth: 3, displayOrder: 1, isActive: true },
    ],
    products: [{
      id: 'database-sofa', slug: 'database-sofa', name: 'Database Sofa', description: 'A catalogued sofa.', price: 2400,
      category: 'seating', categoryId: 'sofa', themeSlugs: ['japanese-modern'], displayOrder: 1, isActive: true,
      imageTone: 'sofa', imageUrl: 'https://assets.example/database-sofa.jpg', galleryImageUrls: [], finishes: ['Oat'],
    }, {
      id: 'database-cabinetry', slug: 'database-cabinetry', name: 'Database Cabinetry', description: 'A catalogued cabinetry item.', price: 0,
      category: 'cabinetry', categoryId: 'cabinetry-units', themeSlugs: ['japanese-modern'], displayOrder: 2, isActive: true,
      imageTone: 'cabinetry', imageUrl: 'https://assets.example/database-cabinetry.jpg', galleryImageUrls: [], finishes: [],
    }],
  });
  mockGetPublicStyleRangeBySlug.mockResolvedValue(japaneseModernRange);
  mockListPublicHomeThemeBlocks.mockResolvedValue([{
    id: 'home-japanese-modern', rangeSlug: 'japanese-modern', rangeName: 'Japanese Modern',
    eyebrow: 'Interior design', headline: 'Calm, Refined, Timeless',
    description: 'Homepage editorial copy for Japanese Modern.', imageUrl: null, displayOrder: 1,
  }]);
});

test('renders a theme page from its managed style range and product records', async () => {
  window.history.pushState({}, '', '/products/japanese-modern');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Quietly considered living.' })).toBeInTheDocument();
  expect(screen.getByText('Japanese Modern', { selector: '.theme-products__copy .eyebrow' })).toBeInTheDocument();
  expect(screen.getByText('Clean lines and natural materials for everyday living.')).toBeInTheDocument();
  expect(screen.getByText('Complementary Wall & Floor Finishes')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Furniture' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sofa' })).toBeInTheDocument();
  expect(screen.getByText('Database Sofa')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Order cabinets' })).toHaveAttribute('href', '/products/japanese-modern/cabinetry');
  const productVisual = screen.getByRole('img', { name: 'Database Sofa' });
  expect(productVisual).toHaveAttribute('src', 'https://assets.example/database-sofa.jpg');
  expect(getComputedStyle(productVisual).display).toBe('block');
  expect(getComputedStyle(productVisual).objectFit).toBe('cover');
});

test('uses the matching homepage theme block copy in the range hero', async () => {
  window.history.pushState({}, '', '/products/japanese-modern');
  render(<App />);

  expect(await screen.findByText('Calm, Refined, Timeless', { selector: '.theme-products__hero h2' })).toBeInTheDocument();
  expect(screen.getByText('Interior design', { selector: '.theme-products__hero .eyebrow' })).toBeInTheDocument();
});

test('renders range hero copy in white over the hero image', async () => {
  window.history.pushState({}, '', '/products/japanese-modern');
  render(<App />);

  const heading = await screen.findByText('Calm, Refined, Timeless', { selector: '.theme-products__hero h2' });
  const eyebrow = screen.getByText('Interior design', { selector: '.theme-products__hero .eyebrow' });
  expect(getComputedStyle(heading).color).toBe('rgba(255, 255, 255, 0.7)');
  expect(getComputedStyle(eyebrow).color).toBe('rgba(255, 255, 255, 0.7)');
});

test('styles product-page module headings like the editorial eyebrow', async () => {
  window.history.pushState({}, '', '/products/japanese-modern');
  render(<App />);

  const eyebrow = await screen.findByText('Japanese Modern', { selector: '.theme-products__copy .eyebrow' });
  expect(eyebrow.querySelector('.primary-section-heading__marker')).toHaveTextContent('>');
  expect(getComputedStyle(eyebrow).fontFamily).toBe('var(--font-ui)');
  expect(getComputedStyle(eyebrow).fontSize).toBe('0.805rem');
  expect(getComputedStyle(eyebrow).fontWeight).toBe('700');
  expect(getComputedStyle(eyebrow).letterSpacing).toBe('.1em');
  expect(getComputedStyle(eyebrow).color).toBe('var(--color-orange)');
  for (const heading of [screen.getByText('Complementary Wall & Floor Finishes'), screen.getByRole('heading', { name: 'Furniture' }), screen.getByRole('heading', { name: 'Cabinets' })]) {
    expect(getComputedStyle(heading).fontFamily).toBe('var(--font-ui)');
    expect(getComputedStyle(heading).fontSize).toBe('0.805rem');
    expect(getComputedStyle(heading).fontWeight).toBe('700');
    expect(getComputedStyle(heading).letterSpacing).toBe('.1em');
    expect(getComputedStyle(heading).color).toBe('var(--color-orange)');
    expect(heading.querySelector('.primary-section-heading__marker')).toHaveTextContent('>');
    expect(getComputedStyle(heading).textUnderlineOffset).toBe('');
  }
  for (const heading of [screen.getByRole('heading', { name: 'Sofa' }), screen.getByRole('heading', { name: 'Cabinet units' })]) {
    expect(getComputedStyle(heading).fontFamily).toBe('var(--font-ui)');
    expect(getComputedStyle(heading).fontSize).toBe('0.68rem');
    expect(getComputedStyle(heading).fontWeight).toBe('700');
    expect(getComputedStyle(heading).letterSpacing).toBe('.1em');
    expect(getComputedStyle(heading).color).toBe('var(--color-orange)');
    expect(getComputedStyle(heading).textTransform).toBe('uppercase');
  }
});

test('does not substitute a local theme when the managed range is unavailable', async () => {
  mockGetPublicStyleRangeBySlug.mockResolvedValue(null);
  window.history.pushState({}, '', '/products/japandi');
  render(<App />);

  expect(await screen.findByText('Range unavailable.')).toBeInTheDocument();
  expect(screen.queryByText('Japandi Interiors')).not.toBeInTheDocument();
});

test('renders managed palette names with material images or fallback colours', () => {
  render(<PaletteRow palette={japaneseModernRange.palette} />);

  expect(screen.getByText('Stone')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Stone material' }).style.backgroundImage).toContain('stone.jpg');
  expect(screen.getByText('Timber')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Timber material' })).toHaveStyle({ backgroundColor: '#9A6A45' });
});
