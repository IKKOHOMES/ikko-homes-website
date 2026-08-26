import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listPublicProjects, type PublicProject } from '../../lib/public-projects';

export function FeaturedProjects() {
  const [cloudProjects, setCloudProjects] = useState<PublicProject[]>([]);
  useEffect(() => { let active = true; void listPublicProjects().then((value) => { if (active) setCloudProjects(value); }).catch(() => undefined); return () => { active = false; }; }, []);
  if (!cloudProjects.length) return null;
  return <section className="featured-projects">
    <div className="featured-projects__heading"><p className="eyebrow">Featured Projects</p><h2>Inspired spaces. Real homes.</h2></div>
    <div className="featured-projects__grid">
      {cloudProjects.map((project) => <Link className="featured-project-card" key={project.id} to={`/projects/${project.slug}`}>
        {project.coverImageUrl ? <img alt={project.name} className="project-image" src={project.coverImageUrl} /> : <span aria-label={`${project.name} project visual`} className={`project-image project-image--${project.imageTone}`} role="img" />}
        <h3>{project.name}</h3><p>{project.location}</p>
      </Link>)}
    </div>
  </section>;
}
