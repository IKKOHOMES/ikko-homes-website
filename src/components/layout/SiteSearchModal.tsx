import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicCatalogue, type PublicProduct } from '../../lib/public-content';
import { listPublicProjects, type PublicProject } from '../../lib/public-projects';

type SiteSearchModalProps = { onClose: () => void };

function includesKeyword(keyword: string, values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLocaleLowerCase().includes(keyword));
}

export function SiteSearchModal({ onClose }: SiteSearchModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([listPublicCatalogue(), listPublicProjects()]).then(([catalogue, projectList]) => {
      if (active) { setProducts(catalogue.products); setProjects(projectList); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { active = false; window.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);
  const keyword = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => ({
    products: keyword ? products.filter((product) => includesKeyword(keyword, [product.name, product.description, product.category, ...product.themeSlugs])) : [],
    projects: keyword ? projects.filter((project) => includesKeyword(keyword, [project.name, project.introduction, project.location, project.style])) : [],
  }), [keyword, products, projects]);
  const hasResults = matches.products.length > 0 || matches.projects.length > 0;
  return <div className="site-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label="Search IKKO Homes" aria-modal="true" className="site-search-modal" role="dialog">
      <div className="site-search-modal__heading"><div><p className="eyebrow">Search</p><h2>Find products & projects</h2></div><button aria-label="Close search" onClick={onClose} type="button">×</button></div>
      <input aria-label="Search IKKO Homes" autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search products or projects" role="searchbox" value={query} />
      <div className="site-search-modal__results">{loading ? <p>Loading search…</p> : failed ? <p className="error">Search is unavailable right now. Please try again.</p> : !keyword ? <p>Search products and projects by name, style or location.</p> : !hasResults ? <p>No matching products or projects.</p> : <>{matches.products.length > 0 && <section><h3>Products</h3>{matches.products.map((product) => <Link key={product.id} onClick={onClose} to={`/products/${product.slug}`}><b>{product.name}</b><span>{product.category}</span></Link>)}</section>}{matches.projects.length > 0 && <section><h3>Projects</h3>{matches.projects.map((project) => <Link key={project.id} onClick={onClose} to={`/projects/${project.slug}`}><b>{project.name}</b><span>{project.location}</span></Link>)}</section>}</>}</div>
    </section>
  </div>;
}
