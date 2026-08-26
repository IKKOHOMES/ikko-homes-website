import { Fragment, useEffect, useState } from 'react';
import aboutInterior from '../assets/ikko-japandi.png';
import { listPublishedBlogPosts, type PublicBlogPost } from '../lib/public-blogs';

const process = [
  ['01', 'Design', 'We begin with your brief, spatial planning and a material direction that feels true to the way you want to live.'],
  ['02', 'Hard finishes', 'Cabinetry, flooring, tiles, paint, bathroom products and lighting are selected and supplied as one considered package.'],
  ['03', 'Furniture supply', 'Furniture is curated around the home’s proportions, palette and everyday rituals, from key pieces to practical layers.'],
  ['04', 'Finishing touches', 'Artwork, curtains and decorative objects complete the space with warmth, personality and balance.'],
];

const postTypeLabel = { journal: 'Journal', rednote: 'Rednote', facebook: 'Facebook', youtube: 'YouTube', instagram: 'Instagram' } as const;

export function AboutPage() {
  const [posts, setPosts] = useState<PublicBlogPost[]>([]);

  useEffect(() => {
    let active = true;
    void listPublishedBlogPosts().then((value) => {
      if (active) setPosts(value);
    }).catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="about-page">
      <section className="about-intro" id="about-us">
        <div className="about-intro__copy">
          <p className="eyebrow">About IKKO Homes</p>
          <p>
            IKKO HOMES offers a complete, one-stop interior solution from cabinetry, flooring, tiles, paint, bathroom products and lighting to furniture, artwork, curtains and decorative pieces. Our collections are shaped around three distinctive interior styles — <strong>Modern Japanese, Japandi and Organic Modern</strong> — each offering a different approach to contemporary living while sharing the same focus on thoughtful design, quality materials and everyday comfort.
          </p>
        </div>
        <img alt="IKKO Homes interior overview" src={aboutInterior} />
      </section>

      <section aria-label="Our process" className="about-process" id="our-process">
        <div className="about-process__heading">
          <p className="eyebrow">Our process</p>
          <p>From the first idea to the finishing layer, one connected path keeps every decision aligned.</p>
        </div>
        <div aria-label="Design to styling process flow" className="about-process__diagram" role="img">
          {process.map(([number, title], index) => (
            <Fragment key={number}>
              <div className="about-process__step"><span>{number}</span><b>{title}</b></div>
              {index < process.length - 1 && <i aria-hidden="true" className="about-process__arrow">{'>'}</i>}
            </Fragment>
          ))}
        </div>
        <ol>
          {process.map(([number, title, copy]) => (
            <li key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></li>
          ))}
        </ol>
      </section>

      <section aria-label="Blogs and media" className="about-media">
        <div className="about-media__heading">
          <p className="eyebrow">Blogs & media</p>
          <h2>Ideas worth living with.</h2>
        </div>
        {posts.length > 0 && (
          <div className="about-media__grid">
            {posts.map((post, index) => (
              post.destinationUrl ? <a className={`about-media__card about-media__card--${index + 1}`} href={post.destinationUrl} key={post.id} rel="noopener noreferrer" target="_blank">
                {post.coverImageUrl && <img alt={post.title} src={post.coverImageUrl} />}
                <p>{postTypeLabel[post.postType]}</p>
                <h3>{post.title}</h3>
                <span>{post.excerpt}</span>
              </a> : <article className={`about-media__card about-media__card--${index + 1}`} key={post.id}>
                {post.coverImageUrl && <img alt={post.title} src={post.coverImageUrl} />}
                <p>{postTypeLabel[post.postType]}</p>
                <h3>{post.title}</h3>
                <span>{post.excerpt}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
