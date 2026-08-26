import { useState } from 'react';
import { fallbackProductDetailContent, normaliseProductDetailContent, productDetailKeys, productDetailLabels, type ProductDetailContent } from '../../types/product-detail-content';

type DetailTabsProps = {
  productName: string;
  isCabinetry: boolean;
  detailContent?: ProductDetailContent;
};

const labels = productDetailKeys.map((key) => productDetailLabels[key]) as [string, ...string[]];

export function DetailTabs({ productName, isCabinetry, detailContent }: DetailTabsProps) {
  const [active, setActive] = useState<(typeof labels)[number]>('Description');
  const idBase = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const panelId = `${idBase}-detail-panel`;
  const tabId = (label: (typeof labels)[number]) => `${idBase}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tab`;
  const fallback = fallbackProductDetailContent(productName, isCabinetry);
  const managedContent = normaliseProductDetailContent(detailContent);
  const activeKey = productDetailKeys.find((key) => productDetailLabels[key] === active) ?? 'description';
  const activeContent = managedContent[activeKey].body || managedContent[activeKey].bullets.length ? managedContent[activeKey] : fallback[activeKey];

  return (
    <section className="detail-tabs" aria-label="Product information">
      <div className="detail-tabs__list" role="tablist" aria-label={`${productName} information`}>
        {labels.map((label) => (
          <button
            aria-controls={panelId}
            aria-selected={active === label}
            className={active === label ? 'is-active' : ''}
            id={tabId(label)}
            key={label}
            onClick={() => setActive(label)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div aria-labelledby={tabId(active)} className="detail-tabs__content" id={panelId} role="tabpanel" tabIndex={0}>
        <div>{activeContent.body.split(/\n\s*\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        {activeContent.bullets.length > 0 && <ul>{activeContent.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
      </div>
    </section>
  );
}
