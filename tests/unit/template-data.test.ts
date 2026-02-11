import { describe, it, expect } from 'vitest';
import { restaurantTemplate } from '../../src/db/templates/restaurant';
import { retailTemplate } from '../../src/db/templates/retail';
import { medicalTemplate } from '../../src/db/templates/medical';
import { serviceTemplate } from '../../src/db/templates/service';

const allTemplates = [
  { name: 'restaurant', template: restaurantTemplate },
  { name: 'retail', template: retailTemplate },
  { name: 'medical', template: medicalTemplate },
  { name: 'service', template: serviceTemplate },
];

describe('Template Data', () => {
  it('should have 4 industry templates', () => {
    expect(allTemplates).toHaveLength(4);
  });

  for (const { name, template } of allTemplates) {
    describe(`${name} template`, () => {
      it('should have at least 5 categories', () => {
        expect(template.categories.length).toBeGreaterThanOrEqual(5);
      });

      it('should have at least 12 products', () => {
        expect(template.products.length).toBeGreaterThanOrEqual(12);
      });

      it('should have categories with name and sortOrder', () => {
        for (const cat of template.categories) {
          expect(cat.name).toBeTruthy();
          expect(typeof cat.sortOrder).toBe('number');
        }
      });

      it('should have products with valid category references', () => {
        const categoryNames = template.categories.map((c) => c.name);
        for (const prod of template.products) {
          expect(categoryNames).toContain(prod.category);
        }
      });

      it('should have products with valid prices and stock', () => {
        for (const prod of template.products) {
          expect(prod.price).toBeGreaterThan(0);
          expect(prod.stockQuantity).toBeGreaterThanOrEqual(0);
        }
      });

      it('should have settings with currency and taxRate', () => {
        expect(template.settings).toBeDefined();
        expect(template.settings.currency).toBe('TWD');
        expect(typeof template.settings.taxRate).toBe('number');
      });
    });
  }

  it('should have restaurant template with prepTime in metadata', () => {
    const withMeta = restaurantTemplate.products.filter((p) => p.metadata);
    expect(withMeta.length).toBeGreaterThan(0);
    const parsed = JSON.parse(withMeta[0].metadata!);
    expect(parsed.prepTime).toBeDefined();
  });

  it('should have retail template with sku and barcode', () => {
    const withSku = retailTemplate.products.filter((p) => 'sku' in p);
    expect(withSku.length).toBeGreaterThan(0);
    const withBarcode = retailTemplate.products.filter((p) => 'barcode' in p);
    expect(withBarcode.length).toBeGreaterThan(0);
  });

  it('should have medical template with dosage metadata', () => {
    const drugs = medicalTemplate.products.filter(
      (p) => p.category === '藥品' && p.metadata
    );
    expect(drugs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(drugs[0].metadata!);
    expect(parsed.dosage).toBeDefined();
  });

  it('should have service template with duration metadata', () => {
    const services = serviceTemplate.products.filter(
      (p) => p.metadata && p.category !== '套票'
    );
    expect(services.length).toBeGreaterThan(0);
    const parsed = JSON.parse(services[0].metadata!);
    expect(parsed.duration_minutes).toBeDefined();
  });
});
