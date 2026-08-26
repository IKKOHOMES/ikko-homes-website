-- Import the supplied Product Gray V1 catalogue as editable priced products.
-- Source assets remain PNG files in product-assets/product-gray-v1/<range>/.

insert into public.product_categories (name, slug, parent_id, depth, display_order)
select child.name, child.slug, parent.id, 3, child.display_order
from (values
  ('Other furniture', 'other-furniture', 'living', 4),
  ('Bar chair', 'bar-chair', 'dining', 3),
  ('Sideboard', 'sideboard', 'dining', 4)
) as child(name, slug, parent_slug, display_order)
join public.product_categories parent on parent.slug = child.parent_slug
on conflict (slug) do update
set name = excluded.name,
    parent_id = excluded.parent_id,
    depth = excluded.depth,
    display_order = excluded.display_order,
    is_active = true;

with seed (
  range_slug,
  storage_folder,
  file_name,
  slug,
  name,
  category_slug,
  price,
  display_order
) as (
  values
    ('japandi', 'japandi', '028-dining-talbe-2-gray.png', 'product-gray-v1-japandi-028-dining-table-2', 'Japandi Dining Table 028', 'dining-table', 2590.00, 1001),
    ('japandi', 'japandi', '029-Dining-table-6-gray.png', 'product-gray-v1-japandi-029-dining-table-6', 'Japandi Dining Table 029', 'dining-table', 2890.00, 1002),
    ('japandi', 'japandi', '035-bed-3---wsc-gray-warm-bedding.png', 'product-gray-v1-japandi-035-bed-3', 'Japandi Bed 035', 'beds', 3490.00, 1003),
    ('japandi', 'japandi', '040-奶芙沙发-wsc-gray.png', 'product-gray-v1-japandi-milk-foam-sofa', 'Milk Foam Sofa', 'sofa', 3490.00, 1004),
    ('japandi', 'japandi', '043-sofa-2--gray.png', 'product-gray-v1-japandi-043-sofa-2', 'Japandi Sofa 043', 'sofa', 3890.00, 1005),
    ('japandi', 'japandi', '052-coffee-table-9--gray.png', 'product-gray-v1-japandi-052-coffee-table-9', 'Japandi Coffee Table 052', 'coffee-table', 1090.00, 1006),
    ('japandi', 'japandi', '053-coffee-table-8--gray.png', 'product-gray-v1-japandi-053-coffee-table-8', 'Japandi Coffee Table 053', 'coffee-table', 1190.00, 1007),
    ('japandi', 'japandi', '059-bed-3-gray.png', 'product-gray-v1-japandi-059-bed-3', 'Japandi Bed 059', 'beds', 3190.00, 1008),
    ('japandi', 'japandi', '060-bed-10-gray.png', 'product-gray-v1-japandi-060-bed-10', 'Japandi Bed 060', 'beds', 3790.00, 1009),
    ('japandi', 'japandi', '065-product-gray-table-only.png', 'product-gray-v1-japandi-065-table', 'Japandi Table 065', 'coffee-table', 1290.00, 1010),
    ('japandi', 'japandi', '066-product-gray.png', 'product-gray-v1-japandi-066', 'Japandi Collection Piece 066', 'other-furniture', 990.00, 1011),
    ('japandi', 'japandi', '067-product-gray.png', 'product-gray-v1-japandi-067', 'Japandi Collection Piece 067', 'other-furniture', 1090.00, 1012),
    ('japandi', 'japandi', '068-product-gray.png', 'product-gray-v1-japandi-068', 'Japandi Collection Piece 068', 'other-furniture', 1190.00, 1013),
    ('japandi', 'japandi', '069-product-gray.png', 'product-gray-v1-japandi-069', 'Japandi Collection Piece 069', 'other-furniture', 1290.00, 1014),
    ('japandi', 'japandi', '070-product-gray.png', 'product-gray-v1-japandi-070', 'Japandi Collection Piece 070', 'other-furniture', 1390.00, 1015),
    ('japandi', 'japandi', '072-product-gray.png', 'product-gray-v1-japandi-072', 'Japandi Collection Piece 072', 'other-furniture', 1490.00, 1016),
    ('japandi', 'japandi', '074-product-gray-light-oak.png', 'product-gray-v1-japandi-074-light-oak', 'Japandi Light Oak Piece 074', 'other-furniture', 1090.00, 1017),
    ('japandi', 'japandi', '076-product-gray.png', 'product-gray-v1-japandi-076', 'Japandi Collection Piece 076', 'other-furniture', 1190.00, 1018),
    ('japandi', 'japandi', '077-product-gray.png', 'product-gray-v1-japandi-077', 'Japandi Collection Piece 077', 'other-furniture', 1290.00, 1019),
    ('japandi', 'japandi', '078-product-gray.png', 'product-gray-v1-japandi-078', 'Japandi Collection Piece 078', 'other-furniture', 1390.00, 1020),
    ('japandi', 'japandi', '080-product-gray.png', 'product-gray-v1-japandi-080', 'Japandi Collection Piece 080', 'other-furniture', 1490.00, 1021),
    ('japandi', 'japandi', '083-product-gray.png', 'product-gray-v1-japandi-083', 'Japandi Collection Piece 083', 'other-furniture', 1590.00, 1022),
    ('japandi', 'japandi', '084-product-gray.png', 'product-gray-v1-japandi-084', 'Japandi Collection Piece 084', 'other-furniture', 1690.00, 1023),
    ('japandi', 'japandi', '089-product-gray-side-table-centered.png', 'product-gray-v1-japandi-089-side-table', 'Japandi Side Table 089', 'side-table', 690.00, 1024),
    ('japandi', 'japandi', 'exec-fe8199d8-84da-4147-9be2-3e5885b6948d.png', 'product-gray-v1-japandi-collection-piece-exec', 'Japandi Collection Piece', 'other-furniture', 1190.00, 1025),
    ('japandi', 'japandi', 'japandi-dining-table-gray.png', 'product-gray-v1-japandi-dining-table', 'Japandi Dining Table', 'dining-table', 2990.00, 1026),
    ('japandi', 'japandi', 'organic-dining-table-01-gray.png', 'product-gray-v1-japandi-organic-dining-table', 'Organic Dining Table 01', 'dining-table', 3190.00, 1027),
    ('japandi', 'japandi', 'pearl-sofa-gray.png', 'product-gray-v1-japandi-pearl-sofa', 'Pearl Sofa', 'sofa', 4190.00, 1028),
    ('japandi', 'japandi', 'roman-coffee-table-gray.png', 'product-gray-v1-japandi-roman-coffee-table', 'Roman Coffee Table', 'coffee-table', 1190.00, 1029),
    ('japandi', 'japandi', 'round-stone-coffee-table-gray.png', 'product-gray-v1-japandi-round-stone-coffee-table', 'Round Stone Coffee Table', 'coffee-table', 1390.00, 1030),

    ('japanese-modern', 'japanese modern', '041-sofa-4--gray.png', 'product-gray-v1-japanese-modern-041-sofa-4', 'Japanese Modern Sofa 041', 'sofa', 3290.00, 1031),
    ('japanese-modern', 'japanese modern', '042-sofa-3--gray.png', 'product-gray-v1-japanese-modern-042-sofa-3', 'Japanese Modern Sofa 042', 'sofa', 3490.00, 1032),
    ('japanese-modern', 'japanese modern', '044-sofa-1--gray.png', 'product-gray-v1-japanese-modern-044-sofa-1', 'Japanese Modern Sofa 044', 'sofa', 3790.00, 1033),
    ('japanese-modern', 'japanese modern', '045-Sideboard2-gray.png', 'product-gray-v1-japanese-modern-045-sideboard', 'Japanese Modern Sideboard 045', 'sideboard', 2790.00, 1034),
    ('japanese-modern', 'japanese modern', '046-Dining-table-7-gray.png', 'product-gray-v1-japanese-modern-046-dining-table-7', 'Japanese Modern Dining Table 046', 'dining-table', 2690.00, 1035),
    ('japanese-modern', 'japanese modern', '047-Dining-table-15-gray.png', 'product-gray-v1-japanese-modern-047-dining-table-15', 'Japanese Modern Dining Table 047', 'dining-table', 2990.00, 1036),
    ('japanese-modern', 'japanese modern', '048-Dining-table-14-gray.png', 'product-gray-v1-japanese-modern-048-dining-table-14', 'Japanese Modern Dining Table 048', 'dining-table', 3290.00, 1037),
    ('japanese-modern', 'japanese modern', '050-Dining-chair-3-gray.png', 'product-gray-v1-japanese-modern-050-dining-chair-3', 'Japanese Modern Dining Chair 050', 'dining-chair', 690.00, 1038),
    ('japanese-modern', 'japanese modern', '051-Dining-chair-2-gray.png', 'product-gray-v1-japanese-modern-051-dining-chair-2', 'Japanese Modern Dining Chair 051', 'dining-chair', 750.00, 1039),
    ('japanese-modern', 'japanese modern', '054-coffee-table-7--gray.png', 'product-gray-v1-japanese-modern-054-coffee-table-7', 'Japanese Modern Coffee Table 054', 'coffee-table', 890.00, 1040),
    ('japanese-modern', 'japanese modern', '055-coffee-table-6--gray.png', 'product-gray-v1-japanese-modern-055-coffee-table-6', 'Japanese Modern Coffee Table 055', 'coffee-table', 990.00, 1041),
    ('japanese-modern', 'japanese modern', '056-coffee-table-10--gray.png', 'product-gray-v1-japanese-modern-056-coffee-table-10', 'Japanese Modern Coffee Table 056', 'coffee-table', 1090.00, 1042),
    ('japanese-modern', 'japanese modern', '057-coffee-table-1--gray.png', 'product-gray-v1-japanese-modern-057-coffee-table-1', 'Japanese Modern Coffee Table 057', 'coffee-table', 1190.00, 1043),
    ('japanese-modern', 'japanese modern', '058-bed-6-gray.png', 'product-gray-v1-japanese-modern-058-bed-6', 'Japanese Modern Bed 058', 'beds', 3290.00, 1044),
    ('japanese-modern', 'japanese modern', '062-product-gray-table-only-woodtop.png', 'product-gray-v1-japanese-modern-062-table', 'Japanese Modern Table 062', 'coffee-table', 1290.00, 1045),
    ('japanese-modern', 'japanese modern', '063-product-gray.png', 'product-gray-v1-japanese-modern-063', 'Japanese Modern Collection Piece 063', 'other-furniture', 980.00, 1046),
    ('japanese-modern', 'japanese modern', '071-product-gray.png', 'product-gray-v1-japanese-modern-071', 'Japanese Modern Collection Piece 071', 'other-furniture', 1090.00, 1047),
    ('japanese-modern', 'japanese modern', '073-product-gray.png', 'product-gray-v1-japanese-modern-073', 'Japanese Modern Collection Piece 073', 'other-furniture', 1190.00, 1048),
    ('japanese-modern', 'japanese modern', '075-product-gray.png', 'product-gray-v1-japanese-modern-075', 'Japanese Modern Collection Piece 075', 'other-furniture', 1290.00, 1049),
    ('japanese-modern', 'japanese modern', '079-product-gray.png', 'product-gray-v1-japanese-modern-079', 'Japanese Modern Collection Piece 079', 'other-furniture', 1390.00, 1050),
    ('japanese-modern', 'japanese modern', '081-product-gray.png', 'product-gray-v1-japanese-modern-081', 'Japanese Modern Collection Piece 081', 'other-furniture', 1490.00, 1051),
    ('japanese-modern', 'japanese modern', '082-product-gray.png', 'product-gray-v1-japanese-modern-082', 'Japanese Modern Collection Piece 082', 'other-furniture', 1590.00, 1052),
    ('japanese-modern', 'japanese modern', '086-product-gray.png', 'product-gray-v1-japanese-modern-086', 'Japanese Modern Collection Piece 086', 'other-furniture', 1690.00, 1053),
    ('japanese-modern', 'japanese modern', 'cloud-coffee-table-gray.png', 'product-gray-v1-japanese-modern-cloud-coffee-table', 'Cloud Coffee Table', 'coffee-table', 1290.00, 1054),
    ('japanese-modern', 'japanese modern', 'japanese-modern-sideboard-gray.png', 'product-gray-v1-japanese-modern-sideboard', 'Japanese Modern Sideboard', 'sideboard', 2990.00, 1055),

    ('organic-modern', 'organic modern', '021-Boom沙发-my-gray.png', 'product-gray-v1-organic-modern-boom-sofa', 'Boom Sofa', 'sofa', 3990.00, 1056),
    ('organic-modern', 'organic modern', '023-边几-mj-5-gray.png', 'product-gray-v1-organic-modern-side-table-5', 'Organic Modern Side Table 5', 'side-table', 690.00, 1057),
    ('organic-modern', 'organic modern', '024-边几-mj-4-gray.png', 'product-gray-v1-organic-modern-side-table-4', 'Organic Modern Side Table 4', 'side-table', 720.00, 1058),
    ('organic-modern', 'organic modern', '025-床头柜-mj-3-gray.png', 'product-gray-v1-organic-modern-bedside-table-3', 'Organic Modern Bedside Table 3', 'bedside-table', 790.00, 1059),
    ('organic-modern', 'organic modern', '026-边几-mj-2-gray.png', 'product-gray-v1-organic-modern-side-table-2', 'Organic Modern Side Table 2', 'side-table', 650.00, 1060),
    ('organic-modern', 'organic modern', '027-边几-mj-1-gray.png', 'product-gray-v1-organic-modern-side-table-1', 'Organic Modern Side Table 1', 'side-table', 680.00, 1061),
    ('organic-modern', 'organic modern', '030-河马椅-gray.png', 'product-gray-v1-organic-modern-hippo-lounge-chair', 'Hippo Lounge Chair', 'other-furniture', 1490.00, 1062),
    ('organic-modern', 'organic modern', '031-Dining-chair-8-gray.png', 'product-gray-v1-organic-modern-031-dining-chair-8', 'Organic Modern Dining Chair 031', 'dining-chair', 790.00, 1063),
    ('organic-modern', 'organic modern', '032-Dining-chair-1-gray.png', 'product-gray-v1-organic-modern-032-dining-chair-1', 'Organic Modern Dining Chair 032', 'dining-chair', 690.00, 1064),
    ('organic-modern', 'organic modern', '034-bed-4--my-gray.png', 'product-gray-v1-organic-modern-034-bed-4', 'Organic Modern Bed 034', 'beds', 3490.00, 1065),
    ('organic-modern', 'organic modern', '037-bed-1---mj-gray.png', 'product-gray-v1-organic-modern-037-bed-1', 'Organic Modern Bed 037', 'beds', 3990.00, 1066),
    ('organic-modern', 'organic modern', '038-bar-chair-2-gray-front-boucle.png', 'product-gray-v1-organic-modern-038-bar-chair-2', 'Organic Modern Bar Chair 038', 'bar-chair', 690.00, 1067),
    ('organic-modern', 'organic modern', '039-bar-chair-1-gray-corrected.png', 'product-gray-v1-organic-modern-039-bar-chair-1', 'Organic Modern Bar Chair 039', 'bar-chair', 650.00, 1068),
    ('organic-modern', 'organic modern', '085-product-gray.png', 'product-gray-v1-organic-modern-085', 'Organic Modern Collection Piece 085', 'other-furniture', 1290.00, 1069),
    ('organic-modern', 'organic modern', 'bubble-island-sofa-gray.png', 'product-gray-v1-organic-modern-bubble-island-sofa', 'Bubble Island Sofa', 'sofa', 5490.00, 1070),
    ('organic-modern', 'organic modern', 'chameleon-sofa-gray.png', 'product-gray-v1-organic-modern-chameleon-sofa', 'Chameleon Sofa', 'sofa', 4990.00, 1071),
    ('organic-modern', 'organic modern', 'cotton-candy-sofa-gray.png', 'product-gray-v1-organic-modern-cotton-candy-sofa', 'Cotton Candy Sofa', 'sofa', 4590.00, 1072),
    ('organic-modern', 'organic modern', 'eve-sofa-gray.png', 'product-gray-v1-organic-modern-eve-sofa', 'Eve Sofa', 'sofa', 3790.00, 1073),
    ('organic-modern', 'organic modern', 'exec-e2bec351-f405-469f-bfee-de9d074d0c34.png', 'product-gray-v1-organic-modern-collection-piece-exec', 'Organic Modern Collection Piece', 'other-furniture', 1390.00, 1074),
    ('organic-modern', 'organic modern', 'four-seasons-stone-coffee-table-gray.png', 'product-gray-v1-organic-modern-four-seasons-coffee-table', 'Four Seasons Stone Coffee Table', 'coffee-table', 1390.00, 1075),
    ('organic-modern', 'organic modern', 'hill-coffee-table-gray.png', 'product-gray-v1-organic-modern-hill-coffee-table', 'Hill Coffee Table', 'coffee-table', 1290.00, 1076),
    ('organic-modern', 'organic modern', 'jade-coffee-table-gray.png', 'product-gray-v1-organic-modern-jade-coffee-table', 'Jade Coffee Table', 'coffee-table', 1190.00, 1077),
    ('organic-modern', 'organic modern', 'monet-coffee-table-gray.png', 'product-gray-v1-organic-modern-monet-coffee-table', 'Monet Coffee Table', 'coffee-table', 1290.00, 1078),
    ('organic-modern', 'organic modern', 'pumpkin-sofa-gray.png', 'product-gray-v1-organic-modern-pumpkin-sofa', 'Pumpkin Sofa', 'sofa', 4290.00, 1079),
    ('organic-modern', 'organic modern', 'square-marble-coffee-table-gray.png', 'product-gray-v1-organic-modern-square-marble-coffee-table', 'Square Marble Coffee Table', 'coffee-table', 1490.00, 1080),
    ('organic-modern', 'organic modern', 'tobo-sofa-gray.png', 'product-gray-v1-organic-modern-tobo-sofa', 'Tobo Sofa', 'sofa', 4290.00, 1081)
), category_data as (
  select
    seed.*,
    category.id as category_id,
    primary_category.name as primary_name,
    secondary_category.name as secondary_name,
    category.name as leaf_name
  from seed
  join public.product_categories category on category.slug = seed.category_slug
  join public.product_categories secondary_category on secondary_category.id = category.parent_id
  join public.product_categories primary_category on primary_category.id = secondary_category.parent_id
)
insert into public.products (
  name,
  slug,
  description,
  price,
  category,
  subcategory,
  category_id,
  theme_slugs,
  image_tone,
  image_path,
  is_active,
  display_order
)
select
  name,
  slug,
  format('A considered %s %s selected for calm, contemporary interiors.', replace(range_slug, '-', ' '), lower(leaf_name)),
  price,
  primary_name,
  secondary_name || ' / ' || leaf_name,
  category_id,
  array[range_slug],
  'product',
  'product-gray-v1/' || storage_folder || '/' || file_name,
  true,
  display_order
from category_data
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    category = excluded.category,
    subcategory = excluded.subcategory,
    category_id = excluded.category_id,
    theme_slugs = excluded.theme_slugs,
    image_tone = excluded.image_tone,
    image_path = excluded.image_path,
    is_active = true,
    display_order = excluded.display_order;
