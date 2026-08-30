-- RTPSC EMPLOYEE IDENTITY / ACCOUNT / CREDENTIAL GOVERNANCE
-- Strict lifecycle. No plaintext passwords, tokens, recovery codes or secrets.
CREATE TABLE IF NOT EXISTS employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  employee_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  work_email citext NOT NULL,
  job_title text NOT NULL,
  department text,
  manager_user_id uuid REFERENCES crm_users(id),
  employment_status text NOT NULL DEFAULT 'pending' CHECK (employment_status IN ('pending','active','leave','suspended','terminated')),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,employee_number),
  UNIQUE(workspace_id,work_email)
);

CREATE TABLE IF NOT EXISTS employee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  employee_id uuid NOT NULL UNIQUE REFERENCES employee_profiles(id),
  username citext NOT NULL,
  password_hash text,
  account_state text NOT NULL DEFAULT 'invited' CHECK (account_state IN ('invited','pending','active','suspended','locked','disabled','terminated')),
  must_change_password boolean NOT NULL DEFAULT true,
  mfa_required boolean NOT NULL DEFAULT false,
  mfa_enrolled_at timestamptz,
  failed_login_count int NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,username)
);

CREATE TABLE IF NOT EXISTS employee_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  account_id uuid NOT NULL REFERENCES employee_accounts(id) ON DELETE RESTRICT,
  credential_type text NOT NULL CHECK (credential_type IN ('password','totp','webauthn','recovery_code','api_key')),
  credential_state text NOT NULL DEFAULT 'active' CHECK (credential_state IN ('pending','active','expired','revoked')),
  secret_hash text,
  secret_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);

CREATE TABLE IF NOT EXISTS employee_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  account_id uuid NOT NULL REFERENCES employee_accounts(id) ON DELETE RESTRICT,
  role_code text NOT NULL CHECK (role_code IN ('owner','admin','ero','practitioner','preparer','collector','viewer')),
  scope_type text NOT NULL DEFAULT 'workspace' CHECK (scope_type IN ('workspace','department','team','case_assignment')),
  scope_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','revoked')),
  granted_by uuid REFERENCES crm_users(id),
  approved_by uuid REFERENCES crm_users(id),
  granted_at timestamptz,
  revoked_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  employee_id uuid NOT NULL REFERENCES employee_profiles(id),
  requested_username citext NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('owner','admin','ero','practitioner','preparer','collector','viewer')),
  requested_by uuid NOT NULL REFERENCES crm_users(id),
  approved_by uuid REFERENCES crm_users(id),
  approval_state text NOT NULL DEFAULT 'pending' CHECK (approval_state IN ('pending','approved','rejected','cancelled')),
  approval_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE IF NOT EXISTS employee_credential_issuance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  account_id uuid NOT NULL REFERENCES employee_accounts(id) ON DELETE RESTRICT,
  credential_id uuid NOT NULL REFERENCES employee_credentials(id) ON DELETE RESTRICT,
  issuance_type text NOT NULL CHECK (issuance_type IN ('initial','reset','replacement','mfa_enrollment','recovery')),
  issued_by uuid REFERENCES crm_users(id),
  approval_required boolean NOT NULL DEFAULT true,
  approved_by uuid REFERENCES crm_users(id),
  delivery_channel text CHECK (delivery_channel IN ('invite_link','identity_provider','in_person','other')),
  token_fingerprint text,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  account_id uuid NOT NULL REFERENCES employee_accounts(id) ON DELETE RESTRICT,
  session_fingerprint text NOT NULL UNIQUE,
  ip_hash text,
  user_agent_hash text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text
);

CREATE TABLE IF NOT EXISTS employee_account_events (
  id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES crm_workspaces(id),
  account_id uuid REFERENCES employee_accounts(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES employee_profiles(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES crm_users(id),
  event_type text NOT NULL CHECK (event_type IN (
    'account_requested','account_created','account_activated','account_suspended','account_locked','account_disabled',
    'account_terminated','username_changed','password_issued','password_changed','password_reset_requested','password_reset_completed',
    'mfa_enrolled','mfa_removed','role_requested','role_granted','role_rejected','role_revoked',
    'credential_issued','credential_revoked','session_revoked','export_attempted'
  )),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_accounts_state ON employee_accounts(workspace_id,account_state);
CREATE INDEX IF NOT EXISTS idx_employee_roles_account ON employee_role_assignments(account_id,status);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_role_assignments(workspace_id,role_code,status);
CREATE INDEX IF NOT EXISTS idx_employee_credentials_state ON employee_credentials(account_id,credential_type,credential_state);
CREATE INDEX IF NOT EXISTS idx_employee_issuance_account ON employee_credential_issuance(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_events_account ON employee_account_events(account_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_account ON employee_sessions(account_id,revoked_at,expires_at);

-- Strict account lookup: tenant + active state are mandatory.
-- SELECT ea.id,ep.employee_number,ep.work_email,ep.job_title,ea.username,ea.account_state,
--        COALESCE(array_agg(era.role_code) FILTER (WHERE era.status='active'),'{}') roles
-- FROM employee_accounts ea
-- JOIN employee_profiles ep ON ep.id=ea.employee_id
-- LEFT JOIN employee_role_assignments era ON era.account_id=ea.id
-- WHERE ea.workspace_id=$1 AND ea.id=$2
-- GROUP BY ea.id,ep.employee_number,ep.work_email,ep.job_title,ea.username,ea.account_state;

-- Effective roles.
-- SELECT DISTINCT era.role_code FROM employee_role_assignments era
-- WHERE era.workspace_id=$1 AND era.account_id=$2 AND era.status='active';

-- Pending account requests requiring approval.
-- SELECT * FROM employee_account_requests
-- WHERE workspace_id=$1 AND approval_state='pending' ORDER BY requested_at;

-- Expired credential cleanup candidate list (revoke, do not delete).
-- SELECT id,account_id,credential_type,expires_at FROM employee_credentials
-- WHERE workspace_id=$1 AND credential_state='active' AND expires_at IS NOT NULL AND expires_at<=now();

-- Accounts requiring password change.
-- SELECT ea.id,ea.username,ep.work_email FROM employee_accounts ea
-- JOIN employee_profiles ep ON ep.id=ea.employee_id
-- WHERE ea.workspace_id=$1 AND ea.account_state='active' AND ea.must_change_password=true;

-- Locked accounts.
-- SELECT ea.*,ep.employee_number,ep.work_email FROM employee_accounts ea
-- JOIN employee_profiles ep ON ep.id=ea.employee_id
-- WHERE ea.workspace_id=$1 AND ea.account_state='locked';

-- Sessions eligible for revocation.
-- SELECT * FROM employee_sessions WHERE workspace_id=$1 AND revoked_at IS NULL AND expires_at<=now();

-- Privileged roles requiring MFA.
-- SELECT ea.id,ea.username,era.role_code,ea.mfa_enrolled_at
-- FROM employee_accounts ea JOIN employee_role_assignments era ON era.account_id=ea.id
-- WHERE ea.workspace_id=$1 AND era.status='active' AND era.role_code IN ('owner','admin','ero') AND ea.mfa_enrolled_at IS NULL;

-- Separation-of-duties review: requester/approver must differ for privileged grants.
-- SELECT id,requested_by,approved_by,requested_role FROM employee_account_requests
-- WHERE workspace_id=$1 AND approval_state='approved'
-- AND requested_role IN ('owner','admin','ero') AND requested_by=approved_by;

-- Credential audit trail.
-- SELECT * FROM employee_account_events WHERE workspace_id=$1 AND account_id=$2 ORDER BY occurred_at DESC;
