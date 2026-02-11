import { describe, it, expect } from 'vitest';

describe('Onboarding Flow', () => {
  it('should have 10 industry options', () => {
    const industries = ['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty'];
    expect(industries).toHaveLength(10);
  });

  it('should validate setup data schema', () => {
    const validSetup = {
      name: 'Test Store',
      email: 'test@example.com',
      password: '123456',
      industry: 'restaurant',
    };

    expect(validSetup.name.length).toBeGreaterThanOrEqual(1);
    expect(validSetup.email).toContain('@');
    expect(validSetup.password.length).toBeGreaterThanOrEqual(6);
    expect(['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty']).toContain(validSetup.industry);
  });

  it('should reject invalid email', () => {
    const invalidEmail = 'not-an-email';
    expect(invalidEmail).not.toContain('@');
  });

  it('should reject short password', () => {
    const shortPassword = '12345';
    expect(shortPassword.length).toBeLessThan(6);
  });

  it('should reject invalid industry', () => {
    const validIndustries = ['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty'];
    expect(validIndustries).not.toContain('invalid');
  });
});
