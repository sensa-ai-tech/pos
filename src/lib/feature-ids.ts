export const FEATURES = {
  POS: 'basic_pos',
  INVENTORY: 'basic_inventory',
  REPORTS: 'basic_reports',
  ADVANCED_INVENTORY: 'advanced_inventory',
  CRM: 'crm',
  MULTI_STORE: 'multi_store',
  EMPLOYEE_MGMT: 'employee_mgmt',
  ANALYTICS: 'analytics',
  ONLINE_ORDERING: 'online_ordering',
  LOYALTY: 'loyalty',
  API_ACCESS: 'api_access',
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];
