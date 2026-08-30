// RTPSC strict identity, employee account and credential governance.
// Passwords are never returned, logged, exported, emailed, or stored in plaintext.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const IDENTITY_POLICY = Object.freeze({
  username: {
    minLength: 6,
    maxLength: 64,
    pattern: /^[a-z][a-z0-9._-]*$/,
    immutableAfterActivation: true
  },
  password: {
    minLength: 15,
    maxLength: 128,
    history: 5,
    maxFailedAttempts: 5,
    lockMinutes: 30,
    resetTokenMinutes: 20,
    inviteTokenMinutes: 30,
    requireMfaForPrivilegedRoles: true,
    denyCommonOrBreached: true
  },
  account: {
    states: ['invited','pending','active','suspended','locked','disabled','terminated'],
    requireUniqueUsernamePerWorkspace: true,
    requireUniqueEmployeeNumberPerWorkspace: true,
    defaultState: 'invited'
  },
  privilegedRoles: ['owner','admin','ero'],
  roles: ['owner','admin','ero','practitioner','preparer','collector','viewer']
});

const ROLE_RANK = Object.freeze({ viewer: 10, preparer: 20, collector: 30, practitioner: 40, ero: 50, admin: 60, owner: 70 });

export function normalizeUsername(value) {
  const username = String(value ?? '').trim().toLowerCase();
  if (!IDENTITY_POLICY.username.pattern.test(username)) throw new Error('Invalid username format');
  if (username.length < IDENTITY_POLICY.username.minLength || username.length > IDENTITY_POLICY.username.maxLength) {
    throw new Error('Invalid username length');
  }
  return username;
}

export function validatePasswordPolicy(password, { username = '', email = '' } = {}) {
  const value = String(password ?? '');
  if (value.length < IDENTITY_POLICY.password.minLength || value.length > IDENTITY_POLICY.password.maxLength) return false;
  const lower = value.toLowerCase();
  const prohibited = [String(username).toLowerCase(), String(email).toLowerCase()].filter(Boolean);
  if (prohibited.some((part) => part.length >= 4 && lower.includes(part))) return false;
  if (IDENTITY_POLICY.password.denyCommonOrBreached && /^(password|qwerty|letmein|welcome|admin|changeme)/i.test(value)) return false;
  return true;
}

export async function hashPassword(password) {
  if (!validatePasswordPolicy(password)) throw new Error('Password does not meet policy');
  const salt = randomBytes(16);
  const derived = await scrypt(Buffer.from(password, 'utf8'), salt, 64, { N: 32768, r: 8, p: 2, maxmem: 128 * 1024 * 1024 });
  return `scrypt$32768$8$2$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const parts = String(encoded ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(Buffer.from(String(password ?? ''), 'utf8'), salt, expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024
  });
  return timingSafeEqual(Buffer.from(actual), expected);
}

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function tokenFingerprint(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

export function canGrantRole(grantingRole, targetRole) {
  if (!ROLE_RANK[grantingRole] || !ROLE_RANK[targetRole]) return false;
  if (grantingRole === 'owner') return true;
  return ROLE_RANK[grantingRole] > ROLE_RANK[targetRole];
}

export function requiresIndependentApproval({ actorRole, requestedRole, action }) {
  if (['role_change','payout_approval','high_value_writeoff','credential_revocation'].includes(action)) return true;
  if (requestedRole === 'owner' || requestedRole === 'admin') return true;
  return ['ero','admin'].includes(requestedRole) && actorRole !== 'owner';
}

export function employeeAccountDefaults({ workspaceId, employeeId, username, role = 'viewer' }) {
  const normalized = normalizeUsername(username);
  if (!IDENTITY_POLICY.roles.includes(role)) throw new Error('Unsupported role');
  return {
    workspaceId,
    employeeId,
    username: normalized,
    role,
    state: IDENTITY_POLICY.account.defaultState,
    mustChangePassword: true,
    mfaRequired: IDENTITY_POLICY.password.requireMfaForPrivilegedRoles && IDENTITY_POLICY.privilegedRoles.includes(role),
    failedLoginCount: 0
  };
}
