/**
 * Ross Tax Pro Software Co. Master Governance (RTP-MASTER-002 v2.0)
 * Private-company IRM-style controls — not an IRS publication.
 */

export const GOVERNANCE_META = Object.freeze({
  company: 'Ross Tax Pro Software Co.',
  policyId: 'RTP-MASTER-002',
  version: '2.0',
  effective: '2026-07-25',
  notice: 'PRIVATE-COMPANY MANUAL - NOT AN IRS PUBLICATION'
});

export const AI_HARD_PROHIBITIONS = Object.freeze([
  'sign_for_a_person',
  'transmit_a_return',
  'represent_a_taxpayer',
  'clear_material_hold',
  'change_bank_data',
  'approve_a_refund',
  'decide_material_tax_position',
  'issue_final_legal_conclusion',
  'self_approve_escalation',
  'unauthorized_discount_or_hidden_fee'
]);

export const PERSONA_REGISTER = Object.freeze([
  {
    id: 'concierge',
    name: 'Concierge',
    title: 'AI Concierge Employee',
    permitted: ['general_service_qa', 'status_navigation', 'create_support_request'],
    prohibited: ['tax_conclusion', 'refund_guarantee', 'cross_client_disclosure', 'bypass_identity_verification'],
    riskDefault: 'low'
  },
  {
    id: 'intake-specialist',
    name: 'Intake Specialist',
    title: 'AI Intake Specialist',
    permitted: ['collect_service_type', 'tax_year_entity_deadline', 'document_checklist', 'classify_uploads'],
    prohibited: ['acceptance_decision', 'legal_conclusion', 'alter_source_documents'],
    riskDefault: 'low'
  },
  {
    id: 'due-diligence-interviewer',
    name: 'Due Diligence Interviewer',
    title: 'AI Due Diligence Interviewer',
    permitted: ['present_approved_questions', 'record_answers_for_human_review'],
    prohibited: ['eligibility_determination', 'coach_desired_result', 'clear_inconsistencies'],
    riskDefault: 'high'
  },
  {
    id: 'document-analyst',
    name: 'Document Analyst',
    title: 'AI Document Analyst',
    permitted: ['extract_metadata', 'detect_missing_pages', 'detect_duplicates', 'likely_categories'],
    prohibited: ['authenticity_certification', 'final_tax_treatment', 'delete_originals'],
    riskDefault: 'moderate'
  },
  {
    id: 'bookkeeping-assistant',
    name: 'Bookkeeping Assistant',
    title: 'AI Bookkeeping Assistant',
    permitted: ['propose_categories', 'propose_reconciliations', 'exception_lists'],
    prohibited: ['final_posting_material_adjustments', 'financial_statement_assurance', 'unsupported_entries'],
    riskDefault: 'moderate'
  },
  {
    id: 'notice-triage-agent',
    name: 'Notice Triage Agent',
    title: 'AI Notice Triage Agent',
    permitted: ['identify_notice_type', 'apparent_deadline', 'requested_information', 'routing'],
    prohibited: ['representation', 'legal_advice', 'agency_contact', 'final_response_without_review'],
    riskDefault: 'high'
  },
  {
    id: 'efile-status-agent',
    name: 'E-file Status Agent',
    title: 'AI E-file Status Agent',
    permitted: ['display_submitted_accepted_rejected_pending'],
    prohibited: ['promise_refund_date', 'bank_funding_promise', 'manual_status_change'],
    riskDefault: 'moderate'
  },
  {
    id: 'billing-service-order-agent',
    name: 'Billing and Service Order Agent',
    title: 'AI Billing & Service Order Agent',
    permitted: ['create_quotes_from_catalog', 'scope_questionnaires', 'payment_requests'],
    prohibited: ['hidden_fee', 'unauthorized_discount', 'refund_approval', 'chargeback_retaliation'],
    riskDefault: 'moderate'
  },
  {
    id: 'security-triage-agent',
    name: 'Security Triage Agent',
    title: 'AI Security Triage Agent',
    permitted: ['detect_suspicious_access', 'credential_sharing_flags', 'unsafe_uploads', 'open_incidents'],
    prohibited: ['unilateral_evidence_deletion', 'public_accusation', 'notification_without_incident_command'],
    riskDefault: 'critical'
  },
  {
    id: 'supervisor-router',
    name: 'Supervisor Router',
    title: 'AI Supervisor Router',
    permitted: ['escalate_to_human_role', 'enforce_hold'],
    prohibited: ['self_approval', 'final_tax_decision', 'disengagement_signature', 'emergency_access_grant'],
    riskDefault: 'high'
  }
]);

export const CRM_RULES = Object.freeze([
  'RTP-CRM-101', 'RTP-CRM-102', 'RTP-CRM-103', 'RTP-CRM-104', 'RTP-CRM-105',
  'RTP-CRM-106', 'RTP-CRM-107', 'RTP-CRM-108', 'RTP-CRM-109', 'RTP-CRM-110',
  'RTP-CRM-111', 'RTP-CRM-112', 'RTP-CRM-113', 'RTP-CRM-114', 'RTP-CRM-115'
]);

export const IRM_GATES = Object.freeze([
  'RTP-IRM-1.1', 'RTP-IRM-2.1', 'RTP-IRM-3.1', 'RTP-IRM-4.1', 'RTP-IRM-5.1',
  'RTP-IRM-6.1', 'RTP-IRM-7.1', 'RTP-IRM-8.1', 'RTP-IRM-9.1', 'RTP-IRM-10.1',
  'RTP-IRM-11.1', 'RTP-IRM-12.1', 'RTP-IRM-13.1', 'RTP-IRM-14.1', 'RTP-IRM-15.1',
  'RTP-IRM-16.1', 'RTP-IRM-17.1'
]);

export const PAID_TASK_STATES = Object.freeze([
  'REQUESTED',
  'AUTHENTICATED',
  'SCOPED',
  'PRICED',
  'PAID_APPROVED',
  'QUEUED',
  'IN_PROGRESS',
  'HUMAN_REVIEW',
  'DELIVERED',
  'ACKNOWLEDGED',
  'RETAINED',
  'NEEDS_INFO',
  'FLAG',
  'HOLD',
  'ESCALATED',
  'CANCELLED',
  'DISENGAGED'
]);

export const RACI = Object.freeze({
  clear_material_due_diligence_flag: { ai: 'I', preparer: 'R', reviewer: 'A', eroManager: 'C' },
  sign_return_authorization: { client: 'R/A', ai: 'I', preparer: 'C' },
  transmit_return: { ai: 'I', preparer: 'R', reviewer: 'C', eroManager: 'A' },
  change_bank_details: { client: 'R', ai: 'I', eroManager: 'A', security: 'C' },
  approve_refund_exception: { ai: 'I', executive: 'A' }
});

export function getPersona(personaId) {
  return PERSONA_REGISTER.find((persona) => persona.id === personaId) || null;
}

export function assertPersonaActionAllowed(personaId, action) {
  const persona = getPersona(personaId);
  if (!persona) {
    return { ok: false, code: 'unknown_persona', message: `Persona ${personaId} is not registered` };
  }
  if (AI_HARD_PROHIBITIONS.includes(action) || persona.prohibited.includes(action)) {
    return {
      ok: false,
      code: 'governance_blocked',
      message: `Action '${action}' is prohibited for ${persona.name}`,
      requiresHuman: true,
      policy: 'RTP-AI-001'
    };
  }
  if (!persona.permitted.includes(action) && !AI_HARD_PROHIBITIONS.includes(action)) {
    // Allow only registered permitted actions for execution
    return {
      ok: false,
      code: 'action_not_permitted',
      message: `Action '${action}' is not in the permitted role for ${persona.name}`,
      requiresHuman: true,
      policy: 'RTP-AI-001'
    };
  }
  return { ok: true, persona, policy: 'RTP-AI-001' };
}

export function humanReviewRequired(riskLevel) {
  switch (String(riskLevel || '').toLowerCase()) {
    case 'critical':
      return { required: true, mode: 'immediate_escalation_hold' };
    case 'high':
      return { required: true, mode: 'mandatory_qualified_human_review' };
    case 'moderate':
      return { required: true, mode: 'spot_check_or_rule_verification' };
    default:
      return { required: false, mode: 'disclaimer_and_sources' };
  }
}

export function governanceBanner() {
  return {
    ...GOVERNANCE_META,
    principles: [
      'Disclose automated assistant interaction',
      'Minimum data for active task only',
      'No taxpayer data in unapproved models/public tools',
      'Human approval for material tax/legal/financial/identity/bank/filing/security/refund/disengagement actions',
      'Immediate route to human reviewer',
      'Audit trail for high-risk tasks',
      'Block hallucinated forms, laws, deadlines, credentials, account status, refund promises'
    ],
    hardProhibitions: AI_HARD_PROHIBITIONS,
    crmRules: CRM_RULES,
    irmGates: IRM_GATES,
    raci: RACI
  };
}

export { SERVICE_CATALOG, getCatalogItem, listCatalog } from './catalog.mjs';
export {
  listPersonasLive,
  createHireRequest,
  authenticateTask,
  scopeTask,
  priceTask,
  payTask,
  queueTask,
  runPersonaStep,
  humanApprove,
  placeHold,
  getTask,
  listTasks,
  listEvents,
  taskStates,
  __resetStoreForTests
} from './tasks.mjs';
