alter table public.blog_posts
  add column post_type text not null default 'journal' check (post_type in ('journal', 'rednote', 'facebook', 'youtube', 'instagram')),
  add column destination_url text;
