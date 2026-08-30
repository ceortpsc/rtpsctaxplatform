-- RTPSC ALL OPERATIONAL SQL QUERY LIBRARY v2
-- PostgreSQL 16 / tenant-scoped / parameterized
-- Use server-resolved workspace_id and bound parameters. Never concatenate tenant IDs.

-- 01 AUTHENTICATION / USER CONTEXT
SELECT id,workspace_id,email,display_name,role,active,created_at
FROM crm_users WHERE id=$1 AND workspace_id=$2 AND active=true;

-- 02 CLIENT 360
SELECT c.*,v.outstanding_balance,v.open_invoices,v.next_due_at
FROM crm_clients c LEFT JOIN crm_v_client_balances v ON v.client_id=c.id
WHERE c.id=$1 AND c.workspace_id=$2;

-- 03 CLIENT SEARCH
SELECT id,first_name,last_name,email,phone,lifecycle_stage,status,assigned_user_id,source,created_at
FROM crm_clients
WHERE workspace_id=$1 AND (first_name ILIKE '%'||$2||'%' OR last_name ILIKE '%'||$2||'%' OR email ILIKE '%'||$2||'%')
ORDER BY last_name,first_name LIMIT $3 OFFSET $4;

-- 04 PIPELINE DISTRIBUTION
SELECT lifecycle_stage,COUNT(*) clients
FROM crm_clients WHERE workspace_id=$1 GROUP BY lifecycle_stage ORDER BY clients DESC;

-- 05 OPEN RECEIVABLES
SELECT * FROM crm_v_client_balances
WHERE workspace_id=$1 AND outstanding_balance>0 ORDER BY outstanding_balance DESC;

-- 06 AGING BY BUCKET
SELECT aging_bucket,COUNT(*) invoices,SUM(balance)::numeric(14,2) balance
FROM crm_v_aging WHERE workspace_id=$1
GROUP BY aging_bucket
ORDER BY CASE aging_bucket WHEN 'current' THEN 0 WHEN '1_30' THEN 1 WHEN '31_60' THEN 2 WHEN '61_90' THEN 3 WHEN '90_plus' THEN 4 END;

-- 07 DETAILED AGING
SELECT * FROM crm_v_aging WHERE workspace_id=$1 ORDER BY days_past_due DESC,balance DESC;

-- 08 COLLECTION QUEUE
SELECT * FROM crm_v_collection_queue WHERE workspace_id=$1 ORDER BY days_past_due DESC,balance DESC;

-- 09 COLLECTION NEXT ACTIONS
SELECT c.*,cl.first_name,cl.last_name,cl.email,cl.phone
FROM crm_collections c JOIN crm_clients cl ON cl.id=c.client_id
WHERE c.workspace_id=$1 AND c.stage NOT IN ('resolved','written_off')
AND (c.next_action_at IS NULL OR c.next_action_at<=now())
ORDER BY c.priority DESC,c.days_past_due DESC;

-- 10 HIGH-RISK COLLECTIONS
SELECT * FROM crm_collections
WHERE workspace_id=$1 AND priority IN ('high','critical') AND stage NOT IN ('resolved','written_off')
ORDER BY days_past_due DESC,balance_at_open DESC;

-- 11 PAYMENT-PLAN DUE / DEFAULT RISK
SELECT pp.*,i.balance,cl.first_name,cl.last_name
FROM crm_payment_plans pp JOIN crm_invoices i ON i.id=pp.invoice_id
JOIN crm_clients cl ON cl.id=pp.client_id
WHERE pp.workspace_id=$1 AND pp.status IN ('active','defaulted') AND pp.next_due_date<=CURRENT_DATE
ORDER BY pp.next_due_date;

-- 12 PAYMENT HISTORY
SELECT p.*,i.invoice_number
FROM crm_payments p LEFT JOIN crm_invoices i ON i.id=p.invoice_id
WHERE p.workspace_id=$1 AND p.client_id=$2 ORDER BY p.paid_at DESC;

-- 13 PRACTITIONER EARNINGS
SELECT * FROM crm_v_practitioner_earnings WHERE workspace_id=$1 ORDER BY fees_charged DESC;

-- 14 PRACTITIONER PENDING PAYOUTS
SELECT practitioner_id,display_name,pending FROM crm_v_practitioner_earnings
WHERE workspace_id=$1 AND pending>0 ORDER BY pending DESC;

-- 15 MONTHLY CASH COLLECTION
SELECT * FROM crm_v_revenue_monthly WHERE workspace_id=$1 ORDER BY month;

-- 16 RECOVERY PERFORMANCE
SELECT * FROM crm_v_recovery WHERE workspace_id=$1 ORDER BY target DESC;

-- 17 ACTIVE RECOVERY CASES
SELECT r.*,c.client_id,c.invoice_id,c.days_past_due,c.stage
FROM crm_recovery_cases r JOIN crm_collections c ON c.id=r.collection_id
WHERE r.workspace_id=$1 AND r.recovery_stage NOT IN ('recovered','closed')
ORDER BY (r.amount_target-r.amount_recovered) DESC;

-- 18 DOCUMENT EXCEPTIONS
SELECT * FROM crm_documents WHERE workspace_id=$1
AND verification_status IN ('pending','rejected','expired') ORDER BY uploaded_at ASC;

-- 19 WORKFLOW RUNS READY FOR PROCESSING
SELECT fr.*,cl.first_name,cl.last_name
FROM crm_flow_runs fr LEFT JOIN crm_clients cl ON cl.id=fr.client_id
WHERE fr.workspace_id=$1 AND fr.status='active' AND (fr.next_run_at IS NULL OR fr.next_run_at<=now())
ORDER BY fr.next_run_at NULLS FIRST;

-- 20 CLIENT TIMELINE
SELECT * FROM crm_activities
WHERE workspace_id=$1 AND client_id=$2 ORDER BY occurred_at DESC LIMIT $3 OFFSET $4;

-- 21 AUDIT TRAIL FOR ENTITY
SELECT * FROM crm_audit_log
WHERE workspace_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY created_at DESC;

-- 22 DUE WITHIN 7 DAYS
SELECT * FROM crm_v_client_balances
WHERE workspace_id=$1 AND outstanding_balance>0 AND next_due_at>=now() AND next_due_at<now()+interval '7 days'
ORDER BY next_due_at;

-- 23 DOCUMENT COMPLETION BY CLIENT
SELECT client_id,
COUNT(*) documents,
COUNT(*) FILTER (WHERE verification_status='verified') verified,
COUNT(*) FILTER (WHERE verification_status='rejected') rejected,
COUNT(*) FILTER (WHERE verification_status='pending') pending
FROM crm_documents WHERE workspace_id=$1 GROUP BY client_id;

-- 24 RETURN / CASE STATUS MIX
SELECT federal_status,state_status,COUNT(*) cases
FROM crm_cases WHERE workspace_id=$1 GROUP BY federal_status,state_status ORDER BY cases DESC;

-- 25 ERO / PRACTITIONER WORKLOAD
SELECT assigned_practitioner_id,COUNT(*) active_cases
FROM crm_cases WHERE workspace_id=$1 AND marked_complete_at IS NULL
GROUP BY assigned_practitioner_id ORDER BY active_cases DESC;

-- 26 OPEN TASK QUEUE
SELECT assigned_user_id,COUNT(*) open_tasks
FROM tasks WHERE workspace_id=$1 AND status NOT IN ('completed','cancelled')
GROUP BY assigned_user_id ORDER BY open_tasks DESC;

-- 27 RECENT COMMUNICATION OUTCOMES
SELECT channel,status,COUNT(*) messages
FROM communications WHERE workspace_id=$1 AND occurred_at>=CURRENT_DATE-INTERVAL '30 days'
GROUP BY channel,status ORDER BY channel,status;

-- 28 APPOINTMENT UTILIZATION
SELECT date_trunc('week',start_at)::date week,COUNT(*) total_appointments,
COUNT(*) FILTER (WHERE status='completed') completed,
COUNT(*) FILTER (WHERE status='no_show') no_show
FROM appointments WHERE workspace_id=$1 GROUP BY 1 ORDER BY 1;

-- 29 TRAINING OVERDUE
SELECT * FROM training_enrollments
WHERE workspace_id=$1 AND status IN ('enrolled','in_progress') AND due_at<CURRENT_DATE
ORDER BY due_at;

-- 30 TRAINING PERFORMANCE
SELECT e.user_id,e.course_id,e.status,r.score_percent,r.passed
FROM training_enrollments e LEFT JOIN training_results r ON r.enrollment_id=e.id
WHERE e.workspace_id=$1 ORDER BY e.user_id,e.course_id;

-- 31 CREDENTIAL ELIGIBILITY
SELECT e.user_id,COUNT(*) required_items,
COUNT(*) FILTER (WHERE e.status='completed') completed_items
FROM training_enrollments e WHERE e.workspace_id=$1 GROUP BY e.user_id;

-- 32 ISSUED CREDENTIALS
SELECT * FROM credentials WHERE workspace_id=$1 AND issue_status='issued'
ORDER BY completion_date DESC;

-- 33 CREDENTIAL EVENT HISTORY
SELECT * FROM credential_events WHERE workspace_id=$1 AND credential_id=$2 ORDER BY created_at DESC;

-- 34 OPEN DISPUTES
SELECT * FROM disputes WHERE workspace_id=$1 AND status IN ('open','investigating') ORDER BY created_at;

-- 35 REFUND EVENTS
SELECT * FROM refund_events WHERE workspace_id=$1 AND client_id=$2 ORDER BY occurred_at DESC;

-- 36 COLLECTION RATE — explicit numerator/denominator
WITH opened AS (
 SELECT COALESCE(SUM(balance_at_open),0)::numeric(14,2) amount_opened
 FROM crm_collections WHERE workspace_id=$1
), recovered AS (
 SELECT COALESCE(SUM(amount_recovered),0)::numeric(14,2) amount_recovered
 FROM crm_recovery_cases WHERE workspace_id=$1
)
SELECT amount_opened,amount_recovered,
CASE WHEN amount_opened>0 THEN ROUND((amount_recovered/amount_opened)*100,2) ELSE 0 END collection_rate_pct
FROM opened,recovered;

-- 37 PIPELINE PROGRESSION — explicit denominator
SELECT
COUNT(*) FILTER (WHERE lifecycle_stage='lead') leads,
COUNT(*) FILTER (WHERE lifecycle_stage<>'lead') progressed,
CASE WHEN COUNT(*) FILTER (WHERE lifecycle_stage='lead')>0 THEN
ROUND((COUNT(*) FILTER (WHERE lifecycle_stage<>'lead')::numeric /
COUNT(*) FILTER (WHERE lifecycle_stage='lead'))*100,2) ELSE 0 END progression_pct
FROM crm_clients WHERE workspace_id=$1;

-- 38 INVOICE/PAYMENT RECONCILIATION EXCEPTION
SELECT i.id,i.invoice_number,i.total,i.balance,
COALESCE(SUM(p.amount) FILTER (WHERE p.status='succeeded'),0)::numeric(14,2) paid
FROM crm_invoices i LEFT JOIN crm_payments p ON p.invoice_id=i.id
WHERE i.workspace_id=$1 GROUP BY i.id,i.invoice_number,i.total,i.balance
HAVING i.balance<0 OR i.total<COALESCE(SUM(p.amount) FILTER (WHERE p.status='succeeded'),0);

-- 39 DATA-QUALITY: ORPHAN / CROSS-TENANT REFERENCE CHECKS
SELECT i.id AS invoice_id FROM crm_invoices i LEFT JOIN crm_clients c ON c.id=i.client_id
WHERE i.workspace_id=$1 AND (c.id IS NULL OR c.workspace_id<>i.workspace_id);

-- 40 DATA-QUALITY: RECOVERY TARGET EXCEEDED
SELECT * FROM crm_recovery_cases
WHERE workspace_id=$1 AND amount_recovered>amount_target;

-- 41 DATA-QUALITY: NEGATIVE BALANCES
SELECT * FROM crm_invoices WHERE workspace_id=$1 AND balance<0;

-- 42 DATA-QUALITY: UNASSIGNED ACTIVE CASES
SELECT * FROM crm_cases WHERE workspace_id=$1 AND marked_complete_at IS NULL AND assigned_practitioner_id IS NULL;

-- 43 COLLECTION SLA: NO NEXT ACTION
SELECT * FROM crm_collections
WHERE workspace_id=$1 AND stage NOT IN ('resolved','written_off') AND next_action_at IS NULL;

-- 44 ROLE/PERMISSION AUDIT INPUT
SELECT id,email,display_name,role,active FROM crm_users
WHERE workspace_id=$1 ORDER BY role,display_name;

-- 45 SECURE EXPORT CLIENT FIELDS
SELECT id,workspace_id,first_name,last_name,email,phone,lifecycle_stage,status,assigned_user_id,source,created_at,updated_at
FROM crm_clients WHERE workspace_id=$1 ORDER BY created_at DESC;

-- 46 MATERIAL ACTION AUDIT TEMPLATE
-- INSERT INTO crm_audit_log(workspace_id,actor_user_id,entity_type,entity_id,action,before_state,after_state)
-- VALUES($1,$2,$3,$4,$5,$6,$7);

-- 47 FINANCIAL CORRECTION PATTERN
-- Never hard-delete settled payments. Create a reversal/refund event and append audit evidence.

-- 48 COLLECTION STAGE TRANSITION PATTERN
-- UPDATE crm_collections SET stage=$1,next_action_at=$2,owner_user_id=$3 WHERE id=$4 AND workspace_id=$5;
-- Then INSERT a crm_audit_log record describing the before/after state.

-- 49 TRAINING FINAL-PASS REVIEW
SELECT e.user_id,e.course_id,r.score_percent,r.passed
FROM training_enrollments e JOIN training_results r ON r.enrollment_id=e.id
WHERE e.workspace_id=$1 AND e.course_id=$2 ORDER BY r.score_percent DESC;

-- 50 KPI SOURCE REGISTER (recommended application metadata)
-- Each dashboard KPI should map to an approved query ID, time window, unit and source-of-truth table/view.
