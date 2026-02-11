import { describe, it, expect } from 'vitest';
import { FEATURES } from '../../src/lib/feature-ids';

describe('Feature Middleware', () => {
  it('should export FEATURES constant with correct keys', () => {
    expect(FEATURES).toBeDefined();
    expect(FEATURES.POS).toBe('basic_pos');
    expect(FEATURES.INVENTORY).toBe('basic_inventory');
    expect(FEATURES.CRM).toBe('crm');
    expect(FEATURES.EMPLOYEE_MGMT).toBe('employee_mgmt');
    expect(FEATURES.ANALYTICS).toBe('analytics');
  });

  it('should have all expected feature IDs', () => {
    const featureIds = Object.values(FEATURES);
    expect(featureIds).toContain('basic_pos');
    expect(featureIds).toContain('basic_inventory');
    expect(featureIds).toContain('basic_reports');
    expect(featureIds).toContain('crm');
    expect(featureIds).toContain('employee_mgmt');
    expect(featureIds).toContain('analytics');
    expect(featureIds).toContain('loyalty');
  });

  it('should have unique feature IDs', () => {
    const featureIds = Object.values(FEATURES);
    const uniqueIds = new Set(featureIds);
    expect(uniqueIds.size).toBe(featureIds.length);
  });

  it('should have string type for all feature IDs', () => {
    for (const [key, value] of Object.entries(FEATURES)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
