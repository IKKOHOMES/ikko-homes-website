import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicProjectBySlug, type PublicProject } from '../lib/public-projects';

export function ProjectDetailPage() {
  const slug = useParams().slug ?? '';
  const [cloudProject, setCloudProject] = useState<PublicProject | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setCloudProject(undefined);

    void getPublicProjectBySlug(slug)
      .then((project) => {
        if (active) setCloudProject(project);
      })
      .catch(() => {
        if (active) setCloudProject(null);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (cloudProject === undefined) {
    return <section className="content-section editorial"><p>Loading project…</p></section>;
  }

  if (!cloudProject) {
    return (
      <section className="content-section editorial">
        <p className="eyebrow">IKKO Homes</p>
        <h1>Project not found.</h1>
        <p className="lede">Please return to our project collection.</p>
        <Link className="button" to="/projects">View projects</Link>
      </section>
    );
  }

  const project = cloudProject;
  const gallery = project.gallery;

  return (
    <section className="project-detail-page">
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link to="/">Home</Link><span>›</span><Link to="/projects">Projects</Link><span>›</span><span>{project.name}</span>
      </nav>

      <header className="project-info">
        <div className="project-info__copy">
          <p className="eyebrow">{project.style}</p>
          <h1>{project.name}</h1>
          <p className="project-info__location">{project.location}</p>
          <p className="project-info__introduction">{project.introduction}</p>
        </div>
        {project.coverImageUrl && (
          <figure className="project-info__cover">
            <img alt={`${project.name} cover image`} src={project.coverImageUrl} />
          </figure>
        )}
      </header>

      {gallery.length > 0 && (
        <section aria-label={`${project.name} gallery`} className="project-gallery">
          <div className="project-gallery__heading">
            <p className="eyebrow">Gallery</p>
            <h2>Project gallery.</h2>
          </div>
          <div className="project-gallery__grid">
            {gallery.map((image, index) => (
              <figure className="project-gallery__item" key={`${image}-${index}`}>
                <img alt={`${project.name} gallery image ${index + 1}`} src={image} />
              </figure>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
