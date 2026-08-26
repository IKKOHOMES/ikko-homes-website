-- Supabase Storage rejects non-ASCII object keys. Keep these source PNGs intact
-- while using ASCII-safe destination names for their public storage paths.

update public.products
set image_path = case slug
  when 'product-gray-v1-japandi-milk-foam-sofa' then 'product-gray-v1/japandi/040-milk-foam-sofa-wsc-gray.png'
  when 'product-gray-v1-organic-modern-boom-sofa' then 'product-gray-v1/organic modern/021-boom-sofa-my-gray.png'
  when 'product-gray-v1-organic-modern-side-table-5' then 'product-gray-v1/organic modern/023-side-table-mj-5-gray.png'
  when 'product-gray-v1-organic-modern-side-table-4' then 'product-gray-v1/organic modern/024-side-table-mj-4-gray.png'
  when 'product-gray-v1-organic-modern-bedside-table-3' then 'product-gray-v1/organic modern/025-bedside-table-mj-3-gray.png'
  when 'product-gray-v1-organic-modern-side-table-2' then 'product-gray-v1/organic modern/026-side-table-mj-2-gray.png'
  when 'product-gray-v1-organic-modern-side-table-1' then 'product-gray-v1/organic modern/027-side-table-mj-1-gray.png'
  when 'product-gray-v1-organic-modern-hippo-lounge-chair' then 'product-gray-v1/organic modern/030-hippo-chair-gray.png'
  else image_path
end
where slug in (
  'product-gray-v1-japandi-milk-foam-sofa',
  'product-gray-v1-organic-modern-boom-sofa',
  'product-gray-v1-organic-modern-side-table-5',
  'product-gray-v1-organic-modern-side-table-4',
  'product-gray-v1-organic-modern-bedside-table-3',
  'product-gray-v1-organic-modern-side-table-2',
  'product-gray-v1-organic-modern-side-table-1',
  'product-gray-v1-organic-modern-hippo-lounge-chair'
);
