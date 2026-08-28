export type FurnitureProductInput = {
  productId?: unknown;
  slug?: unknown;
  name?: unknown;
};

export type ResolvedFurnitureProduct = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
};

export type ProductLookup = (
  field: 'id' | 'slug' | 'name',
  values: string[],
) => Promise<ResolvedFurnitureProduct[]>;

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unique(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export async function resolveFurnitureProducts(
  lines: FurnitureProductInput[],
  lookup: ProductLookup,
): Promise<Array<ResolvedFurnitureProduct | null>> {
  const productIds = unique(lines
    .map((line) => optionalString(line.productId))
    .filter((id): id is string => Boolean(id && isUuid(id))));
  const productsById = new Map(
    productIds.length ? (await lookup('id', productIds)).map((product) => [product.id, product]) : [],
  );
  const resolved = lines.map((line) => {
    const productId = optionalString(line.productId);
    return productId && isUuid(productId) ? productsById.get(productId) ?? null : null;
  });

  const productSlugs = unique(lines
    .filter((_, index) => !resolved[index])
    .map((line) => optionalString(line.slug))
    .filter((slug): slug is string => Boolean(slug)));
  const productsBySlug = new Map(
    productSlugs.length ? (await lookup('slug', productSlugs)).map((product) => [product.slug, product]) : [],
  );
  for (const [index, line] of lines.entries()) {
    if (resolved[index]) continue;
    const slug = optionalString(line.slug);
    if (slug) resolved[index] = productsBySlug.get(slug) ?? null;
  }

  const productNames = unique(lines
    .filter((_, index) => !resolved[index])
    .map((line) => optionalString(line.name))
    .filter((name): name is string => Boolean(name)));
  const productsByName = new Map<string, ResolvedFurnitureProduct[]>();
  for (const product of productNames.length ? await lookup('name', productNames) : []) {
    productsByName.set(product.name, [...(productsByName.get(product.name) ?? []), product]);
  }
  for (const [index, line] of lines.entries()) {
    if (resolved[index]) continue;
    const name = optionalString(line.name);
    const matches = name ? productsByName.get(name) ?? [] : [];
    resolved[index] = matches.length === 1 ? matches[0] : null;
  }

  return resolved;
}
