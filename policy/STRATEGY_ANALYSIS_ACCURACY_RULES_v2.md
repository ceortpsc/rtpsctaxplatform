# RTPSC Strategy & Analysis Accuracy Rules v2

## 1. Decision-quality standards
Every strategy metric must declare its source query/view, measurement window, population, unit, numerator/denominator where applicable, and whether it represents actual cash, accrual, pipeline, forecast, or scenario analysis.

## 2. System-of-record rules
- Client balances: invoice/payment ledger.
- Return/e-file status: authorized tax/e-file subsystem.
- Document status: document verification records.
- Practitioner earnings: practitioner-fee ledger.
- Training completion: enrollment, assignment and assessment results.
- Credentials: credential event history.

## 3. AI analysis rules
AI may summarize records, detect anomalies, prioritize queues, draft communications and propose next actions. AI must not invent balances, payments, refunds, return statuses, training completion, credentials, or approvals; material recommendations must identify the source records/query used.

## 4. Authorization rules
RBAC supplies baseline permissions. ABAC additionally evaluates tenant, assignment, object sensitivity, lifecycle/status locks, maker-checker separation, and purpose of access.

## 5. Financial integrity
Financial records use non-destructive corrections. Use void, reverse, refund, adjustment or archive events instead of hard deletion. Settled payment amounts are not overwritten. Issued credentials are revoked rather than deleted. Audit history is append-only.

## 6. Operational reasoning
Collections strategy must distinguish current, overdue, disputed, payment-plan, recovery and written-off states. A delinquency KPI must show the aging bucket and balance basis. Write-off, legal escalation and other consequential actions require configured approval gates.

## 7. Training and credential strategy
A credential can be issued only after identity verification, authorized role mapping, required course completion, assessment thresholds and final approval. Job title alone never establishes competence; the job title selects the applicable credential pathway.

## 8. Separation of duties
Role administration, e-file transmission, practitioner payout, high-value write-off and credential revocation have independent approval controls where configured. A user should not approve a privileged action they originated.
