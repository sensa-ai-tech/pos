import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';

describe('Database Schema', () => {
  it('should export all 12 required tables', () => {
    expect(schema.tenants).toBeDefined();
    expect(schema.users).toBeDefined();
    expect(schema.categories).toBeDefined();
    expect(schema.products).toBeDefined();
    expect(schema.orders).toBeDefined();
    expect(schema.orderItems).toBeDefined();
    expect(schema.payments).toBeDefined();
    expect(schema.customers).toBeDefined();
    expect(schema.featureCatalog).toBeDefined();
    expect(schema.tenantFeatures).toBeDefined();
    expect(schema.industryTemplates).toBeDefined();
    expect(schema.inventory).toBeDefined();
  });

  it('should have correct table structure with required columns', () => {
    // Verify key columns exist on important tables
    expect(schema.tenants.id).toBeDefined();
    expect(schema.tenants.name).toBeDefined();
    expect(schema.tenants.industry).toBeDefined();

    expect(schema.products.id).toBeDefined();
    expect(schema.products.name).toBeDefined();
    expect(schema.products.price).toBeDefined();
    expect(schema.products.stockQuantity).toBeDefined();

    expect(schema.orders.id).toBeDefined();
    expect(schema.orders.orderNumber).toBeDefined();
    expect(schema.orders.total).toBeDefined();
    expect(schema.orders.status).toBeDefined();

    expect(schema.orderItems.orderId).toBeDefined();
    expect(schema.orderItems.productId).toBeDefined();
    expect(schema.orderItems.quantity).toBeDefined();
  });

  it('should have tenant_id field on user-data tables', () => {
    // Check that key tables have tenantId column
    expect(schema.users.tenantId).toBeDefined();
    expect(schema.products.tenantId).toBeDefined();
    expect(schema.orders.tenantId).toBeDefined();
    expect(schema.payments.tenantId).toBeDefined();
    expect(schema.customers.tenantId).toBeDefined();
    expect(schema.categories.tenantId).toBeDefined();
    expect(schema.tenantFeatures.tenantId).toBeDefined();
    expect(schema.inventory.tenantId).toBeDefined();
  });
});
