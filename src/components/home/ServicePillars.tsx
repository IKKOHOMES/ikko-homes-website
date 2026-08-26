import { Armchair, ClipboardCheck, PanelsTopLeft, UsersRound } from 'lucide-react';
import type { PublicServicePillar } from '../../lib/public-home-content';

const icons = { consultation: UsersRound, joinery: PanelsTopLeft, furniture: Armchair, delivery: ClipboardCheck };

export function ServicePillars({ pillars }: { pillars: PublicServicePillar[] }) {
  if (!pillars.length) return null;
  return <section className="service-pillars" aria-label="IKKO Homes services">
    {pillars.map(({ id, title, description, iconKey }) => { const Icon = icons[iconKey]; return <article key={id}>
      <Icon aria-hidden="true" size={30} strokeWidth={1.35} />
      <h2>{title}</h2>
      <p>{description}</p>
    </article>; })}
  </section>;
}
