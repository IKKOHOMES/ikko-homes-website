import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { AdminProjectsPage } from '../pages/admin/AdminProjectsPage';

const api = vi.hoisted(() => ({
  archiveManagedProject: vi.fn(),
  deleteManagedProject: vi.fn(),
  getManagedProject: vi.fn(),
  listManagedProjects: vi.fn(async () => []),
  listManagedStyleRanges: vi.fn(async () => [{ id: 'range-japandi', slug: 'japandi', name: 'Japandi', eyebrow: 'Japandi', headline: 'Warmth.', description: 'Quiet interiors.', heroImagePath: null, roomImagePath: null, palette: [], displayOrder: 1, isActive: true }]),
  publicAssetUrl: vi.fn(() => null),
  saveManagedProject: vi.fn(),
  uploadProjectImage: vi.fn(),
}));

vi.mock('../lib/admin-api', () => api);

test('generates a project slug from its name and selects a managed range', async () => {
  const user = userEvent.setup();
  render(<AdminProjectsPage />);

  await user.click(await screen.findByRole('button', { name: 'Add project' }));
  await user.type(screen.getByLabelText('Name'), 'Bondi Residence');

  expect(screen.getByLabelText('URL slug')).toHaveValue('bondi-residence');
  expect(screen.getByLabelText('URL slug')).toHaveAttribute('readonly');
  await user.selectOptions(screen.getByLabelText('Range'), 'Japandi');
  expect(screen.getByLabelText('Range')).toHaveValue('Japandi');
});

test('updates an existing project slug when its name changes', async () => {
  const project = {
    id: 'project-bondi', name: 'Bondi Residence', slug: 'bondi-residence', location: 'Sydney, NSW',
    introduction: 'A calm family home.', style: 'Japandi', coverImagePath: null,
    isActive: true, displayOrder: 1, gallery: [],
  };
  api.listManagedProjects.mockResolvedValueOnce([project] as never);
  api.getManagedProject.mockResolvedValueOnce(project as never);
  const user = userEvent.setup();
  render(<AdminProjectsPage />);

  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  await user.clear(await screen.findByLabelText('Name'));
  await user.type(screen.getByLabelText('Name'), 'Coastal House');

  expect(screen.getByLabelText('URL slug')).toHaveValue('coastal-house');
});

test('does not show a project slug in the management table', async () => {
  const project = {
    id: 'project-springvale', name: 'Springvale Townhouses', slug: 'springvale-townhouses', location: 'Springvale, VIC',
    introduction: 'A townhouse project.', style: 'Japandi', coverImagePath: null,
    isActive: true, displayOrder: 1, gallery: [],
  };
  api.listManagedProjects.mockResolvedValueOnce([project] as never);
  render(<AdminProjectsPage />);

  expect(await screen.findByText('Springvale Townhouses')).toBeInTheDocument();
  expect(screen.queryByText('springvale-townhouses')).not.toBeInTheDocument();
});
