import { FormEvent, useCallback, useEffect, useState } from 'react';
import { GalleryEditor, type GalleryImage } from '../../components/admin/GalleryEditor';
import { ImageUpload } from '../../components/admin/ImageUpload';
import { AdminModal } from '../../components/admin/AdminModal';
import {
  archiveManagedProject,
  deleteManagedProject,
  getManagedProject,
  listManagedProjects,
  listManagedStyleRanges,
  publicAssetUrl,
  saveManagedProject,
  uploadProjectImage,
} from '../../lib/admin-api';
import type { ProjectSaveInput } from '../../lib/admin-api';
import type { ManagedProject, ManagedStyleRange } from '../../types/domain';

const blank = (): ProjectSaveInput => ({
  name: '', slug: '', location: '', introduction: '', style: '', coverImagePath: null,
  isActive: true, displayOrder: 0, gallery: [],
});

function projectSlugFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function AdminProjectsPage() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [styleRanges, setStyleRanges] = useState<ManagedStyleRange[]>([]);
  const [value, setValue] = useState<ProjectSaveInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProjects, nextRanges] = await Promise.all([listManagedProjects(), listManagedStyleRanges()]);
      setProjects(nextProjects);
      setStyleRanges(nextRanges);
      setError('');
    } catch {
      setError('Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof ProjectSaveInput>(key: K, next: ProjectSaveInput[K]) => {
    setValue((current) => current ? { ...current, [key]: next } : current);
  };

  const updateName = (name: string) => {
    setValue((current) => current ? {
      ...current,
      name,
      slug: projectSlugFromName(name),
    } : current);
  };

  const edit = async (id: string) => {
    try { setValue(await getManagedProject(id)); }
    catch { setError('Unable to load project details.'); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value) return;
    if (!value.name.trim() || !value.location.trim() || !value.introduction.trim() || !value.style || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) {
      setError('Complete the project fields, select a range and use a URL-safe slug.');
      return;
    }
    try {
      const pendingGallery = value.gallery.filter((image) => image.file);
      const savedGallery = value.gallery.filter((image) => !image.file);
      const saved = await saveManagedProject({ ...value, coverImageFile: undefined, gallery: savedGallery });
      const coverImagePath = value.coverImageFile ? await uploadProjectImage(saved.id, value.coverImageFile) : value.coverImagePath;
      const gallery = await Promise.all(value.gallery.map(async (image) => image.file ? {
        ...image,
        path: await uploadProjectImage(saved.id, image.file),
        file: undefined,
        previewSrc: undefined,
      } : image));
      if (value.coverImageFile || pendingGallery.length) {
        await saveManagedProject({ ...value, id: saved.id, coverImagePath, coverImageFile: undefined, gallery });
      }
      await load();
      setValue(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save project.');
    }
  };

  const archive = async (id: string) => {
    if (!window.confirm('Archive this project?')) return;
    try { await archiveManagedProject(id); await load(); }
    catch { setError('Unable to archive project.'); }
  };

  const remove = async (project: ManagedProject) => {
    if (!window.confirm(`Permanently delete ${project.name}? This cannot be undone.`)) return;
    try {
      await deleteManagedProject(project.id);
      await load();
      if (value?.id === project.id) setValue(null);
    } catch {
      setError('Unable to delete project.');
    }
  };

  const coverPreview = value?.coverImagePath ? publicAssetUrl('project-assets', value.coverImagePath) : null;
  const selectableRanges = styleRanges.filter((range) => range.isActive || range.name === value?.style);

  return (
    <section className="admin-dashboard">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Portfolio management</p><h1>Projects</h1></div>
        <p>Maintain short project details and the ordered project gallery. Archived projects stay in your records.</p>
      </div>
      <div className="admin-toolbar">
        <button className="button" onClick={() => setValue(blank())} type="button">Add project</button>
        <span>{projects.filter((project) => project.isActive).length} visible projects</span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="admin-empty">Loading projects…</p> : <div className="admin-table-wrap">
        <table className="admin-table"><thead><tr><th>Project</th><th>Location</th><th>Status</th><th /></tr></thead><tbody>
          {projects.map((project) => <tr key={project.id}>
            <td><b>{project.name}</b></td>
            <td>{project.location}</td><td>{project.isActive ? 'Visible' : 'Archived'}</td>
            <td className="product-table__actions">
              <button className="admin-text-button" onClick={() => void edit(project.id)} type="button">Edit</button>
              {project.isActive && <button className="admin-text-button" onClick={() => void archive(project.id)} type="button">Archive</button>}
              <button aria-label={`Delete ${project.name}`} className="admin-text-button admin-text-button--danger" onClick={() => void remove(project)} type="button">Delete</button>
            </td>
          </tr>)}
        </tbody></table>
      </div>}
      {value && <AdminModal label={value.id ? `Edit ${value.name}` : 'Add project'} onClose={() => setValue(null)}>
        <form className="product-form" onSubmit={(event) => void submit(event)}>
          <div className="product-form__heading">
            <div><p className="eyebrow">{value.id ? 'Edit project' : 'New project'}</p><h2>{value.name || 'Project details'}</h2></div>
            <button className="admin-text-button" onClick={() => setValue(null)} type="button">Close</button>
          </div>
          <div className="product-form__grid">
            <label>Name<input onChange={(event) => updateName(event.target.value)} value={value.name} /></label>
            <label>URL slug<input readOnly value={value.slug} /></label>
            <label>Location<input onChange={(event) => update('location', event.target.value)} value={value.location} /></label>
            <label>Range<select onChange={(event) => update('style', event.target.value)} value={value.style}>
              <option value="">Select range</option>
              {selectableRanges.map((range) => <option key={range.id} value={range.name}>{range.name}</option>)}
            </select></label>
            <label>Display order<input min="0" onChange={(event) => update('displayOrder', Number(event.target.value))} type="number" value={value.displayOrder} /></label>
            <div><ImageUpload label="Project cover image" onRemove={() => setValue((current) => current ? { ...current, coverImagePath: null, coverImageFile: undefined } : current)} onSelect={(file) => update('coverImageFile', file)} previewSrc={coverPreview} /></div>
            <label className="product-form__full">Short introduction<textarea onChange={(event) => update('introduction', event.target.value)} value={value.introduction} /></label>
            <label className="product-form__toggle"><input checked={value.isActive} onChange={(event) => update('isActive', event.target.checked)} type="checkbox" />Visible on public website</label>
            <div className="product-form__full"><b>Gallery images</b><GalleryEditor images={value.gallery as GalleryImage[]} onChange={(gallery) => update('gallery', gallery)} previewForPath={(path) => publicAssetUrl('project-assets', path) ?? ''} /></div>
          </div>
          <button className="button" type="submit">Save project</button>
        </form>
      </AdminModal>}
    </section>
  );
}
