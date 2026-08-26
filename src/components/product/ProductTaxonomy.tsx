import { useState } from 'react';
import type { Product } from '../../types/catalog';
import { CategoryCarousel } from './CategoryCarousel';

interface CollectionGroup {
  title: string;
  productIds: string[];
  products?: Product[];
}

interface TaxonomyTab {
  label: string;
  groups: CollectionGroup[];
}

type DynamicTaxonomySection = {
  id: string;
  name: string;
  tabs: Array<{
    id: string;
    name: string;
    groups: Array<{ id: string; name: string; products: Product[] }>;
  }>;
};

const furnitureTabs: TaxonomyTab[] = [
  {
    label: 'Living',
    groups: [
      { title: 'Sofa', productIds: ['haru-sofa', 'kumo-modular-sofa', 'aoi-curved-sofa', 'sumi-2-seater-sofa', 'nori-low-sofa', 'kiri-daybed'] },
      { title: 'Coffee table', productIds: ['ryo-table'] },
      { title: 'Side table', productIds: [] },
    ],
  },
  {
    label: 'Dining',
    groups: [
      { title: 'Dining table', productIds: [] },
      { title: 'Dining chair', productIds: [] },
    ],
  },
  {
    label: 'Bedroom',
    groups: [
      { title: 'Beds', productIds: [] },
      { title: 'Bedside table', productIds: [] },
    ],
  },
];

const fixtureTabs: TaxonomyTab[] = [
  {
    label: 'Lighting',
    groups: [
      { title: 'Pendant', productIds: ['nami-light'] },
      { title: 'Lamps', productIds: ['kumo-floor-lamp', 'ren-table-lamp'] },
      { title: 'Wall lights', productIds: ['aki-wall-sconce'] },
    ],
  },
];

function TaxonomySection({ title, tabs, products }: { title: string; tabs: TaxonomyTab[]; products: Product[] }) {
  const [activeLabel, setActiveLabel] = useState(tabs[0].label);
  const activeTab = tabs.find((tab) => tab.label === activeLabel) ?? tabs[0];
  const idPrefix = title.toLowerCase();
  const activeId = `${idPrefix}-${activeTab.label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section className="product-taxonomy__section" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`}><span aria-hidden="true" className="primary-section-heading__marker">&gt;</span> {title}</h2>
      <div className="product-taxonomy__tabs" role="tablist" aria-label={`${title} categories`}>
        {tabs.map((tab) => {
          const tabId = `${idPrefix}-${tab.label.toLowerCase().replace(/\s+/g, '-')}`;
          const selected = tab.label === activeTab.label;
          return <button
            aria-controls={`${tabId}-panel`}
            aria-selected={selected}
            className={selected ? 'is-active' : ''}
            id={tabId}
            key={tab.label}
            onClick={() => setActiveLabel(tab.label)}
            role="tab"
            type="button"
          >{tab.label}</button>;
        })}
      </div>
      <div aria-labelledby={activeId} className="product-taxonomy__panel" id={`${activeId}-panel`} role="tabpanel">
        {activeTab.groups.map((group) => <CategoryCarousel key={group.title} title={group.title} products={group.products ?? products.filter((product) => group.productIds.includes(product.id))} />)}
      </div>
    </section>
  );
}

function dynamicTabs(section: DynamicTaxonomySection): TaxonomyTab[] {
  return section.tabs.map((tab) => ({ label: tab.name, groups: tab.groups.map((group) => ({ title: group.name, productIds: [], products: group.products })) }));
}

export function ProductTaxonomy({ products, sections }: { products: Product[]; sections?: DynamicTaxonomySection[] }) {
  const taxonomy = sections?.length ? sections.map((section) => ({ title: section.name, tabs: dynamicTabs(section) })) : [{ title: 'Furniture', tabs: furnitureTabs }, { title: 'Fixture', tabs: fixtureTabs }];
  return <div className="product-taxonomy">
    {taxonomy.map((section) => <TaxonomySection key={section.title} title={section.title} tabs={section.tabs} products={products} />)}
  </div>;
}
