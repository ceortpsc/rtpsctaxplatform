# RTPSC CRM, Collections & Recovery Suite

## Customer lifecycle
Lead Capture → Onboarding → Engagement → Tax Preparation → Billing & Fees → Filed/Tracking → Collections & Recovery → Loyalty & Growth.

## Workspace surfaces
Executive Dashboard, CRM client 360, intake, documents, tax preparation, e-file, billing, invoices, payments, payment plans, collections, recovery, ERO/practitioner fees, reports, analytics and audit.

## Collection controls
The platform records receivables and automates reminders without changing tax-return outcomes. Legal escalation, credit reporting, or external debt-collection action requires a separately authorized workflow and applicable compliance review.

## Data model
Migration db/migrations/20260830_crm_collections.sql creates tenant-scoped transactional tables, indexes and reporting views. Application queries use bound workspace_id parameters.

## Vercel runtime
Authenticated Next.js Route Handlers/Server Actions handle writes. Scheduled collection jobs validate Authorization: Bearer $CRON_SECRET before processing due actions. Tenant identity is resolved server-side and inbound tenant headers are never trusted.

## Integration boundaries
Payments store processor references/tokens only. Tax/e-file remains authoritative for return status. OpenAI may summarize timelines, prioritize queues, draft reminders and classify documents, but must not invent balances or payment events. GitHub supplies source control and CI.

## Acceptance checks
1. Every client, invoice, payment, collection and fee is workspace-scoped.
2. Payment status controls collected-revenue reporting.
3. Practitioner payout is independent from client invoice balance.
4. Collection stage is auditable.
5. Recovery cannot exceed target without an explicit adjustment.
6. Material writes generate audit records.
