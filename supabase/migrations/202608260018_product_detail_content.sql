alter table public.products
  add column detail_content jsonb not null default '{
    "description": {"body": "", "bullets": []},
    "details": {"body": "", "bullets": []},
    "dimensions": {"body": "", "bullets": []},
    "care": {"body": "", "bullets": []}
  }'::jsonb;

alter table public.cabinetry_products
  add column detail_content jsonb not null default '{
    "description": {"body": "", "bullets": []},
    "details": {"body": "", "bullets": []},
    "dimensions": {"body": "", "bullets": []},
    "care": {"body": "", "bullets": []}
  }'::jsonb;

update public.products
set detail_content = jsonb_build_object(
  'description', jsonb_build_object('body', description, 'bullets', jsonb_build_array()),
  'details', jsonb_build_object(
    'body', 'Built for daily use with carefully selected, long-lasting materials and a refined finish.',
    'bullets', jsonb_build_array(
      'Made with considered craftsmanship',
      'Finish selection confirmed before production',
      'Care instructions supplied on delivery'
    )
  ),
  'dimensions', jsonb_build_object(
    'body', 'Refer to the product specification supplied with your order for complete dimensions.',
    'bullets', jsonb_build_array(
      'Proportioned for everyday comfort',
      'Allow for access and installation clearances'
    )
  ),
  'care', jsonb_build_object(
    'body', 'Follow the care instructions supplied with your product to protect its finish and materials.',
    'bullets', jsonb_build_array(
      'Clean with a soft, dry cloth',
      'Avoid direct sunlight and harsh chemicals'
    )
  )
);

update public.cabinetry_products
set detail_content = jsonb_build_object(
  'description', jsonb_build_object('body', description, 'bullets', jsonb_build_array()),
  'details', jsonb_build_object(
    'body', 'Designed around your room, storage requirements and preferred finishes.',
    'bullets', jsonb_build_array(
      'Made to measure for your space',
      'Detailed drawings confirmed before manufacture',
      'Coordinated installation support'
    )
  ),
  'dimensions', jsonb_build_object(
    'body', 'Final dimensions are confirmed from approved drawings before manufacture.',
    'bullets', jsonb_build_array(
      'Sized to suit your room and services',
      'Clearances reviewed during the design stage'
    )
  ),
  'care', jsonb_build_object(
    'body', 'Use the supplied care guide to protect cabinetry finishes and hardware.',
    'bullets', jsonb_build_array(
      'Wipe surfaces with a soft, damp cloth',
      'Avoid abrasive cleaners and excess moisture'
    )
  )
);
