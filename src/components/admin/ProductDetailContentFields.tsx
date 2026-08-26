import { useState } from 'react';
import { productDetailKeys, productDetailLabels, type ProductDetailContent, type ProductDetailKey } from '../../types/product-detail-content';

type ProductDetailContentFieldsProps = {
  value: ProductDetailContent;
  onChange: (value: ProductDetailContent) => void;
};

export function ProductDetailContentFields({ value, onChange }: ProductDetailContentFieldsProps) {
  const [activeKey, setActiveKey] = useState<ProductDetailKey>('description');
  const update = (key: ProductDetailKey, field: 'body' | 'bullets', next: string) => {
    onChange({
      ...value,
      [key]: field === 'body'
        ? { ...value[key], body: next }
        : { ...value[key], bullets: next.split('\n').map((item) => item.trim()).filter(Boolean) },
    });
  };

  const activeLabel = productDetailLabels[activeKey];

  return <fieldset className="product-form__full product-detail-editor"><legend>Product detail tabs</legend><div aria-label="Product detail tabs" className="product-detail-editor__tabs" role="tablist">{productDetailKeys.map((key) => <button aria-selected={activeKey === key} className={activeKey === key ? 'is-active' : ''} key={key} onClick={() => setActiveKey(key)} role="tab" type="button">{productDetailLabels[key]}</button>)}</div><section className="product-detail-fields"><label>{activeLabel} body<textarea aria-label={`${activeLabel} body`} onChange={(event) => update(activeKey, 'body', event.target.value)} value={value[activeKey].body} /></label>{activeKey === 'description' && <label>Description list<input aria-label="Description list" onChange={(event) => update('description', 'bullets', event.target.value)} value={value.description.bullets.join('\n')} /></label>}</section></fieldset>;
}
