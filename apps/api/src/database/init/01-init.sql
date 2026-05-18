-- =============================================================================
-- Row-Level Security (RLS) – extra security layer on top of Prisma filtering
--
-- How it works:
--   1. The application sets a session variable (app.current_tenant_id) on every
--      database connection before running queries.
--   2. RLS policies automatically filter rows so that only data belonging to the
--      current tenant is visible/modifiable.
--   3. This is a defence-in-depth measure; Prisma already filters by tenantId
--      in application code.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper function: set the current tenant for the session
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id, false);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Helper function: get the current tenant (used in policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_tenant_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- Enable RLS and create policies for tenant-scoped tables
-- ---------------------------------------------------------------------------

-- Macro: for each table, enable RLS and add a policy that filters by tenantId.
-- The policy name follows the pattern: <table>_tenant_isolation

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING ("tenantId" = current_tenant_id());

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_tenant_isolation ON roles
  USING ("tenantId" = current_tenant_id());

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING ("tenantId" = current_tenant_id());

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_tenant_isolation ON categories
  USING ("tenantId" = current_tenant_id());

-- brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY brands_tenant_isolation ON brands
  USING ("tenantId" = current_tenant_id());

-- warehouses
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY warehouses_tenant_isolation ON warehouses
  USING ("tenantId" = current_tenant_id());

-- inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING ("tenantId" = current_tenant_id());

-- inventory_movements
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_movements_tenant_isolation ON inventory_movements
  USING ("tenantId" = current_tenant_id());

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant_isolation ON orders
  USING ("tenantId" = current_tenant_id());

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_isolation ON customers
  USING ("tenantId" = current_tenant_id());

-- suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_tenant_isolation ON suppliers
  USING ("tenantId" = current_tenant_id());

-- financial_accounts
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_accounts_tenant_isolation ON financial_accounts
  USING ("tenantId" = current_tenant_id());

-- accounts_receivable
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_receivable_tenant_isolation ON accounts_receivable
  USING ("tenantId" = current_tenant_id());

-- accounts_payable
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_payable_tenant_isolation ON accounts_payable
  USING ("tenantId" = current_tenant_id());

-- financial_transactions
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_transactions_tenant_isolation ON financial_transactions
  USING ("tenantId" = current_tenant_id());

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING ("tenantId" = current_tenant_id());

-- quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotations_tenant_isolation ON quotations
  USING ("tenantId" = current_tenant_id());

-- purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_tenant_isolation ON purchase_orders
  USING ("tenantId" = current_tenant_id());

-- chart_of_accounts
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY chart_of_accounts_tenant_isolation ON chart_of_accounts
  USING ("tenantId" = current_tenant_id());

-- payment_methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_tenant_isolation ON payment_methods
  USING ("tenantId" = current_tenant_id());

-- leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_tenant_isolation ON leads
  USING ("tenantId" = current_tenant_id());

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING ("tenantId" = current_tenant_id());

-- marketplace_connections
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_connections_tenant_isolation ON marketplace_connections
  USING ("tenantId" = current_tenant_id());

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_isolation ON notifications
  USING ("tenantId" = current_tenant_id());

-- sales_channels
ALTER TABLE sales_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_channels_tenant_isolation ON sales_channels
  USING ("tenantId" = current_tenant_id());

-- cost_centers
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_centers_tenant_isolation ON cost_centers
  USING ("tenantId" = current_tenant_id());

-- tax_rules
ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_rules_tenant_isolation ON tax_rules
  USING ("tenantId" = current_tenant_id());

-- cfops
ALTER TABLE cfops ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfops_tenant_isolation ON cfops
  USING ("tenantId" = current_tenant_id());

-- stock_alerts
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_alerts_tenant_isolation ON stock_alerts
  USING ("tenantId" = current_tenant_id());

-- ---------------------------------------------------------------------------
-- IMPORTANT: The superuser / migration user bypasses RLS by default.
-- The application should connect with a non-superuser role for RLS to
-- take effect. Example:
--
--   CREATE ROLE erp_app LOGIN PASSWORD 'secret';
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO erp_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp_app;
--
-- Superusers and table owners bypass RLS unless you run:
--   ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
-- ---------------------------------------------------------------------------
