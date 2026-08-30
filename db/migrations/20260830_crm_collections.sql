-- RTPSC CRM / BILLING / COLLECTIONS / RECOVERY
-- PostgreSQL 16. Tenant-scoped, append-only ledger for balances and practitioner/ERO fees.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS crm_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_key text NOT NULL UNIQUE, name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  email citext NOT NULL, display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','ero','practitioner','preparer','collector','viewer')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,email)
);
CREATE TABLE IF NOT EXISTS crm_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  external_client_key text, first_name text NOT NULL, last_name text NOT NULL, email text, phone text,
  lifecycle_stage text NOT NULL DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead','intake','engaged','preparing','filed','billing','collections','recovery','retained','closed')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','do_not_contact','closed')),
  assigned_user_id uuid REFERENCES crm_users(id), source text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,external_client_key)
);
CREATE TABLE IF NOT EXISTS crm_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), return_key text, tax_year int, return_type text,
  federal_status text, state_status text, federal_refund numeric(14,2) NOT NULL DEFAULT 0,
  state_refund numeric(14,2) NOT NULL DEFAULT 0, accepted_at timestamptz, marked_complete_at timestamptz,
  closed_at timestamptz, assigned_practitioner_id uuid REFERENCES crm_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_fee_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  code text NOT NULL, name text NOT NULL, category text NOT NULL CHECK (category IN ('tax_prep','ancillary','amended_return','consulting','administrative','other')),
  default_amount numeric(14,2) NOT NULL CHECK (default_amount >= 0), active boolean NOT NULL DEFAULT true,
  UNIQUE(workspace_id,code)
);
CREATE TABLE IF NOT EXISTS crm_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), case_id uuid REFERENCES crm_cases(id),
  invoice_number text NOT NULL, currency char(3) NOT NULL DEFAULT 'USD', issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','partially_paid','paid','void','written_off','disputed')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0, tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0, balance numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE(workspace_id,invoice_number)
);
CREATE TABLE IF NOT EXISTS crm_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
  fee_id uuid REFERENCES crm_fee_catalog(id), description text NOT NULL, quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0, line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_amount) STORED
);
CREATE TABLE IF NOT EXISTS crm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), invoice_id uuid REFERENCES crm_invoices(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0), method text NOT NULL CHECK (method IN ('card','ach','cash','check','refund_offset','other')),
  processor text, processor_reference text, status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending','succeeded','failed','refunded','voided')),
  paid_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES crm_users(id)
);
CREATE TABLE IF NOT EXISTS crm_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), invoice_id uuid NOT NULL REFERENCES crm_invoices(id),
  total_amount numeric(14,2) NOT NULL, installment_amount numeric(14,2) NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')), start_date date NOT NULL,
  next_due_date date NOT NULL, installments_total int NOT NULL, installments_paid int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','defaulted','cancelled')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), invoice_id uuid NOT NULL REFERENCES crm_invoices(id),
  balance_at_open numeric(14,2) NOT NULL, days_past_due int NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'reminder' CHECK (stage IN ('reminder','overdue','escalated','recovery','legal_review','resolved','written_off')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  next_action_at timestamptz, owner_user_id uuid REFERENCES crm_users(id), opened_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS crm_collection_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES crm_collections(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('email','sms','call','portal_notice','payment_link','plan_offer','escalate','dispute','promise_to_pay','write_off','manual_note')),
  outcome text, scheduled_at timestamptz, completed_at timestamptz, notes text, created_by uuid REFERENCES crm_users(id)
);
CREATE TABLE IF NOT EXISTS crm_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  collection_id uuid NOT NULL REFERENCES crm_collections(id),
  recovery_stage text NOT NULL DEFAULT 'contact' CHECK (recovery_stage IN ('contact','promise','plan','partial_recovery','recovered','closed')),
  amount_target numeric(14,2) NOT NULL, amount_recovered numeric(14,2) NOT NULL DEFAULT 0,
  assigned_user_id uuid REFERENCES crm_users(id), opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS crm_practitioner_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  case_id uuid NOT NULL REFERENCES crm_cases(id), practitioner_id uuid NOT NULL REFERENCES crm_users(id),
  fee_type text NOT NULL CHECK (fee_type IN ('prep','amended','consulting','ancillary','bonus','adjustment')),
  amount_charged numeric(14,2) NOT NULL, amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','earned','paid','disputed','void')),
  earned_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid REFERENCES crm_clients(id), case_id uuid REFERENCES crm_cases(id), actor_user_id uuid REFERENCES crm_users(id),
  event_type text NOT NULL, event_payload jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid NOT NULL REFERENCES crm_clients(id), case_id uuid REFERENCES crm_cases(id), file_name text NOT NULL,
  document_type text NOT NULL, storage_key text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','expired')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  client_id uuid REFERENCES crm_clients(id), case_id uuid REFERENCES crm_cases(id), flow_code text NOT NULL,
  current_step text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','failed')),
  next_run_at timestamptz, context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_audit_log (
  id bigserial PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES crm_workspaces(id), actor_user_id uuid REFERENCES crm_users(id),
  entity_type text NOT NULL, entity_id uuid, action text NOT NULL, before_state jsonb, after_state jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_workspace_stage ON crm_clients(workspace_id,lifecycle_stage,status);
CREATE INDEX IF NOT EXISTS idx_cases_workspace_status ON crm_cases(workspace_id,federal_status,state_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON crm_invoices(workspace_id,due_at,status,balance);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON crm_payments(invoice_id,status,paid_at);
CREATE INDEX IF NOT EXISTS idx_collections_stage_due ON crm_collections(workspace_id,stage,days_past_due,next_action_at);
CREATE INDEX IF NOT EXISTS idx_recovery_stage ON crm_recovery_cases(workspace_id,recovery_stage);
CREATE INDEX IF NOT EXISTS idx_practitioner_fees ON crm_practitioner_fees(workspace_id,practitioner_id,status);
CREATE INDEX IF NOT EXISTS idx_activities_client ON crm_activities(client_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_client ON crm_documents(client_id,uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_runs_next ON crm_flow_runs(status,next_run_at);

CREATE OR REPLACE VIEW crm_v_client_balances AS
SELECT c.id client_id,c.workspace_id,c.first_name,c.last_name,c.email,c.phone,
COALESCE(SUM(i.balance) FILTER (WHERE i.status IN ('open','partially_paid','disputed')),0)::numeric(14,2) outstanding_balance,
COUNT(i.id) FILTER (WHERE i.balance>0) open_invoices, MIN(i.due_at) FILTER (WHERE i.balance>0) next_due_at
FROM crm_clients c LEFT JOIN crm_invoices i ON i.client_id=c.id GROUP BY c.id,c.workspace_id,c.first_name,c.last_name,c.email,c.phone;

CREATE OR REPLACE VIEW crm_v_aging AS
SELECT i.workspace_id,i.client_id,i.id invoice_id,i.invoice_number,i.due_at,i.balance,
GREATEST(0,(CURRENT_DATE-i.due_at::date)) days_past_due,
CASE WHEN i.balance<=0 THEN 'paid' WHEN CURRENT_DATE-i.due_at::date <= 0 THEN 'current'
WHEN CURRENT_DATE-i.due_at::date <= 30 THEN '1_30' WHEN CURRENT_DATE-i.due_at::date <= 60 THEN '31_60'
WHEN CURRENT_DATE-i.due_at::date <= 90 THEN '61_90' ELSE '90_plus' END aging_bucket
FROM crm_invoices i WHERE i.status NOT IN ('draft','void','paid','written_off') AND i.balance>0;

CREATE OR REPLACE VIEW crm_v_collection_queue AS
SELECT a.*,c.first_name,c.last_name,c.email,c.phone
FROM crm_v_aging a JOIN crm_clients c ON c.id=a.client_id WHERE a.days_past_due>0
ORDER BY a.days_past_due DESC,a.balance DESC;

CREATE OR REPLACE VIEW crm_v_practitioner_earnings AS
SELECT f.workspace_id,f.practitioner_id,u.display_name,COUNT(*) FILTER (WHERE f.status NOT IN ('void')) returns_or_cases,
SUM(f.amount_charged)::numeric(14,2) fees_charged,SUM(f.amount_paid)::numeric(14,2) paid_out,
SUM(f.amount_charged-f.amount_paid)::numeric(14,2) pending
FROM crm_practitioner_fees f JOIN crm_users u ON u.id=f.practitioner_id
GROUP BY f.workspace_id,f.practitioner_id,u.display_name;

CREATE OR REPLACE VIEW crm_v_revenue_monthly AS
SELECT p.workspace_id,date_trunc('month',p.paid_at)::date month,SUM(p.amount)::numeric(14,2) collected
FROM crm_payments p WHERE p.status='succeeded' GROUP BY p.workspace_id,date_trunc('month',p.paid_at);

CREATE OR REPLACE VIEW crm_v_pipeline AS
SELECT workspace_id,lifecycle_stage,COUNT(*) clients FROM crm_clients GROUP BY workspace_id,lifecycle_stage;

CREATE OR REPLACE VIEW crm_v_recovery AS
SELECT r.workspace_id,r.recovery_stage,COUNT(*) cases,SUM(r.amount_target)::numeric(14,2) target,
SUM(r.amount_recovered)::numeric(14,2) recovered,SUM(r.amount_target-r.amount_recovered)::numeric(14,2) remaining
FROM crm_recovery_cases r GROUP BY r.workspace_id,r.recovery_stage;

-- Bound application queries:
-- SELECT * FROM crm_v_client_balances WHERE workspace_id=$1 AND outstanding_balance>0 ORDER BY outstanding_balance DESC;
-- SELECT * FROM crm_v_aging WHERE workspace_id=$1 ORDER BY days_past_due DESC,balance DESC;
-- SELECT * FROM crm_v_collection_queue WHERE workspace_id=$1;
-- SELECT * FROM crm_v_practitioner_earnings WHERE workspace_id=$1 ORDER BY fees_charged DESC;
-- SELECT * FROM crm_v_revenue_monthly WHERE workspace_id=$1 ORDER BY month;
-- SELECT * FROM crm_v_recovery WHERE workspace_id=$1;
-- SELECT * FROM crm_documents WHERE workspace_id=$1 AND verification_status='pending' ORDER BY uploaded_at;
-- SELECT * FROM crm_v_client_balances WHERE workspace_id=$1 AND next_due_at < now()+interval '7 days' AND outstanding_balance>0;
-- SELECT * FROM crm_collections WHERE workspace_id=$1 AND priority IN ('high','critical') AND stage NOT IN ('resolved','written_off');
-- SELECT practitioner_id,display_name,pending FROM crm_v_practitioner_earnings WHERE workspace_id=$1 AND pending>0;
