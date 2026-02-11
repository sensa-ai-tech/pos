import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============ Tenants ============
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry', { enum: ['restaurant', 'retail', 'medical', 'service'] }).notNull(),
  plan: text('plan', { enum: ['free', 'basic', 'pro', 'enterprise'] }).notNull().default('free'),
  settings: text('settings'), // JSON string for industry-specific settings
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Users ============
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'manager', 'cashier'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Categories ============
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ============ Products ============
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  categoryId: text('category_id').references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  cost: real('cost'),
  sku: text('sku'),
  barcode: text('barcode'),
  imageUrl: text('image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  metadata: text('metadata'), // JSON string for industry-specific fields
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Orders ============
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderNumber: text('order_number').notNull(),
  customerId: text('customer_id').references(() => customers.id),
  status: text('status', { enum: ['pending', 'completed', 'cancelled', 'refunded'] }).notNull().default('pending'),
  subtotal: real('subtotal').notNull(),
  tax: real('tax').notNull().default(0),
  discount: real('discount').notNull().default(0),
  total: real('total').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'card', 'transfer', 'other'] }).notNull(),
  notes: text('notes'),
  metadata: text('metadata'), // JSON for industry-specific: table_number, dine_in, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Order Items ============
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(), // snapshot at time of order
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  subtotal: real('subtotal').notNull(),
  notes: text('notes'),
});

// ============ Payments ============
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  amount: real('amount').notNull(),
  method: text('method').notNull(),
  status: text('status', { enum: ['completed', 'pending', 'failed'] }).notNull().default('completed'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Customers ============
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  notes: text('notes'),
  totalSpent: real('total_spent').notNull().default(0),
  visitCount: integer('visit_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ Feature Catalog ============
export const featureCatalog = sqliteTable('feature_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  priceMonthly: real('price_monthly').notNull(),
  isFree: integer('is_free', { mode: 'boolean' }).notNull().default(false),
});

// ============ Tenant Features ============
export const tenantFeatures = sqliteTable('tenant_features', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  featureId: text('feature_id').notNull().references(() => featureCatalog.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  activatedAt: integer('activated_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

// ============ Industry Templates ============
export const industryTemplates = sqliteTable('industry_templates', {
  id: text('id').primaryKey(),
  industry: text('industry', { enum: ['restaurant', 'retail', 'medical', 'service'] }).notNull(),
  templateData: text('template_data').notNull(), // JSON string
  description: text('description').notNull(),
});

// ============ Inventory (for advanced tracking) ============
export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull().default(0),
  batchNumber: text('batch_number'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  location: text('location'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
