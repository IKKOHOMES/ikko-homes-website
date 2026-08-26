insert into public.products (name, slug, description, price, category, subcategory, theme_slugs, image_tone, display_order) values
  ('Mori Lounge Chair', 'mori-lounge-chair', 'Sculptural simplicity meets everyday comfort, with a solid oak frame and softly supportive cushions.', 1290, 'seating', 'living', '{japanese-modern,japandi}', 'chair', 1),
  ('Haru 3-Seater Sofa', 'haru-3-seater-sofa', 'A generous sofa with balanced proportions, tactile upholstery and a quietly inviting profile.', 1899, 'seating', 'living', '{organic-modern}', 'sofa', 2),
  ('Kumo Modular Sofa', 'kumo-modular-sofa', 'A flexible, low-profile sofa system with soft, generous cushions and relaxed proportions.', 2490, 'seating', 'living', '{japandi}', 'sofa', 3),
  ('Aoi Curved Sofa', 'aoi-curved-sofa', 'A sculpted curved sofa that brings a gentle, inviting silhouette to the living room.', 2290, 'seating', 'living', '{organic-modern}', 'sofa', 4),
  ('Sumi 2-Seater Sofa', 'sumi-2-seater-sofa', 'A compact two-seater with softly rounded arms, tailored for smaller spaces.', 1640, 'seating', 'living', '{japandi}', 'sofa', 5),
  ('Nori Low Sofa', 'nori-low-sofa', 'A grounded, deep-seat sofa with a low silhouette and a calm, contemporary profile.', 2190, 'seating', 'living', '{japandi}', 'sofa', 6),
  ('Kiri Daybed', 'kiri-daybed', 'A versatile oak-framed daybed for quiet reading corners and relaxed afternoon lounging.', 1490, 'seating', 'living', '{japanese-modern}', 'sofa', 7),
  ('Ryo Round Coffee Table', 'ryo-round-coffee-table', 'Rounded oak forms that bring a grounded, relaxed rhythm to the living room.', 699, 'tables', 'living', '{japandi,organic-modern}', 'table', 8),
  ('Nami Pendant Light', 'nami-pendant-light', 'A softly pleated pendant designed to bring warm, ambient light to everyday spaces.', 249, 'lighting', 'pendant', '{japanese-modern,japandi,organic-modern}', 'pendant', 9),
  ('Kumo Floor Lamp', 'kumo-floor-lamp', 'A slender oak floor lamp with a softly diffused linen shade for quiet pools of light.', 590, 'lighting', 'lamps', '{organic-modern}', 'pendant', 10),
  ('Aki Wall Sconce', 'aki-wall-sconce', 'A compact ceramic wall light with a gentle upward glow and a restrained profile.', 329, 'lighting', 'wall-lights', '{japanese-modern,organic-modern}', 'pendant', 11),
  ('Ren Table Lamp', 'ren-table-lamp', 'A hand-finished table lamp that brings texture and warmth to shelves, desks and bedsides.', 395, 'lighting', 'lamps', '{japandi}', 'pendant', 12),
  ('Sora Sideboard', 'sora-sideboard', 'Low oak storage with calm proportions and beautifully restrained detailing.', 1499, 'storage', 'living', '{japandi}', 'sideboard', 13)
on conflict (slug) do nothing;

insert into public.product_finishes (product_id, name, display_order)
select id, finish_name, finish_order
from public.products
join (values
  ('mori-lounge-chair', 'Natural Oak', 0), ('mori-lounge-chair', 'Walnut', 1),
  ('haru-3-seater-sofa', 'Oat Bouclé', 0), ('haru-3-seater-sofa', 'Cloud Linen', 1),
  ('ryo-round-coffee-table', 'Natural Oak', 0), ('ryo-round-coffee-table', 'Smoked Oak', 1),
  ('nami-pendant-light', 'Warm White', 0), ('nami-pendant-light', 'Natural Rattan', 1),
  ('sora-sideboard', 'Natural Oak', 0), ('sora-sideboard', 'Walnut', 1)
) as seeded(slug, finish_name, finish_order) using (slug)
on conflict (product_id, name) do nothing;

insert into public.projects (name, slug, location, introduction, style, image_tone, display_order) values
  ('Bondi Residence', 'bondi-residence', 'Sydney, NSW', 'A calm Bondi home shaped around soft daylight, tactile finishes and the rituals of everyday living.', 'Japandi', 'bondi', 1),
  ('Coastal House', 'coastal-house', 'Byron Bay, NSW', 'Designed for a slower coastal rhythm, this Byron Bay home brings sculptural forms and sun-washed materials together.', 'Organic Modern', 'coastal', 2),
  ('Elwood Apartment', 'elwood-apartment', 'Melbourne, VIC', 'A compact Elwood apartment reimagined as a composed urban sanctuary.', 'Quiet Modern', 'elwood', 3),
  ('Paddington Terrace', 'paddington-terrace', 'Brisbane, QLD', 'This heritage terrace pairs enduring character with a lighter, contemporary way of living.', 'Warm Minimalism', 'paddington', 4)
on conflict (slug) do nothing;
