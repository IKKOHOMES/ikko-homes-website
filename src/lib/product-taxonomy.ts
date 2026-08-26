export type TaxonomyCategory = {
  id: string;
  name: string;
  parentId: string | null;
  depth: 1 | 2 | 3;
  displayOrder: number;
  isActive: boolean;
};

export type TaxonomyProduct = {
  id: string;
  categoryId: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type PublicTaxonomySection<T extends TaxonomyProduct = TaxonomyProduct> = {
  id: string;
  name: string;
  tabs: Array<{
    id: string;
    name: string;
    groups: Array<{ id: string; name: string; products: T[] }>;
  }>;
};

function ordered<T extends { displayOrder: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

export function buildPublicTaxonomy<T extends TaxonomyProduct>(categories: TaxonomyCategory[], products: T[]): PublicTaxonomySection<T>[] {
  const activeCategories = categories.filter((category) => category.isActive);
  const activeProducts = products.filter((product) => product.isActive && product.categoryId);
  const childrenOf = (parentId: string | null, depth: TaxonomyCategory['depth']) => ordered(activeCategories.filter((category) => category.parentId === parentId && category.depth === depth));

  return childrenOf(null, 1).map((section) => {
    const tabs = childrenOf(section.id, 2).map((tab) => {
      const groups = childrenOf(tab.id, 3).map((group) => ({
        id: group.id,
        name: group.name,
        products: ordered(activeProducts.filter((product) => product.categoryId === group.id)),
      })).filter((group) => group.products.length > 0);

      return { id: tab.id, name: tab.name, groups };
    }).filter((tab) => tab.groups.length > 0);

    return { id: section.id, name: section.name, tabs };
  }).filter((section) => section.tabs.length > 0);
}
