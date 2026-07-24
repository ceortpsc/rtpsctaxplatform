/**
 * AOL Signal Codes — conceptual exit, error, and status code registry.
 * Copyright (c) 2026 RTPSC / Ross Tax Software. All rights reserved for AOL PM IP.
 * @see docs/aol-intellectual-property.md
 */

/** Process exit codes (posix-friendly + AOL extensions). */
export const ExitCode = Object.freeze({
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  CONFIG: 3,
  LOCK: 4,
  WORKSPACE: 5,
  SCRIPT: 6,
  IO: 7,
  IP: 8,
  DOCTOR: 9
});

/**
 * Structured error / signal codes.
 * Format: AOL-<DOMAIN><NNN>  (domain: G=general, C=config, L=lock, W=workspace, S=script, I=ip)
 */
export const SignalCode = Object.freeze({
  OK: { code: 'AOL-G000', exit: ExitCode.OK, message: 'Signal clear' },
  UNKNOWN_COMMAND: { code: 'AOL-G001', exit: ExitCode.USAGE, message: 'Unknown command' },
  USAGE: { code: 'AOL-G002', exit: ExitCode.USAGE, message: 'Invalid usage' },
  INTERNAL: { code: 'AOL-G099', exit: ExitCode.ERROR, message: 'Internal signal fault' },

  CONFIG_MISSING: { code: 'AOL-C001', exit: ExitCode.CONFIG, message: 'Configuration file missing' },
  CONFIG_INVALID: { code: 'AOL-C002', exit: ExitCode.CONFIG, message: 'Configuration invalid' },
  CONFIG_READONLY: { code: 'AOL-C003', exit: ExitCode.CONFIG, message: 'Configuration key is read-only' },

  LOCK_MISSING: { code: 'AOL-L001', exit: ExitCode.LOCK, message: 'Lockfile missing' },
  LOCK_STALE: { code: 'AOL-L002', exit: ExitCode.LOCK, message: 'Lockfile fingerprints stale' },
  LOCK_CORRUPT: { code: 'AOL-L003', exit: ExitCode.LOCK, message: 'Lockfile unreadable' },

  WORKSPACE_NOT_FOUND: { code: 'AOL-W001', exit: ExitCode.WORKSPACE, message: 'Workspace not found' },
  WORKSPACE_EMPTY: { code: 'AOL-W002', exit: ExitCode.WORKSPACE, message: 'No workspaces discovered' },
  LINK_BROKEN: { code: 'AOL-W003', exit: ExitCode.WORKSPACE, message: 'Workspace link broken' },

  SCRIPT_MISSING: { code: 'AOL-S001', exit: ExitCode.SCRIPT, message: 'Script not defined' },
  SCRIPT_FAILED: { code: 'AOL-S002', exit: ExitCode.SCRIPT, message: 'Script exited non-zero' },

  IP_NOTICE: { code: 'AOL-I001', exit: ExitCode.OK, message: 'Intellectual property notice' },
  IP_VIOLATION_HINT: { code: 'AOL-I002', exit: ExitCode.IP, message: 'IP policy reminder' }
});

export function getSignal(name) {
  return SignalCode[name] || SignalCode.INTERNAL;
}

export function listCodes() {
  return Object.entries(SignalCode).map(([name, value]) => ({
    name,
    ...value
  }));
}

export function formatCodeLine(entry) {
  return `${entry.code}  exit=${entry.exit}  ${entry.name || ''}  — ${entry.message}`;
}

export class AolError extends Error {
  constructor(signalName, detail = '') {
    const signal = getSignal(signalName);
    super(detail ? `${signal.message}: ${detail}` : signal.message);
    this.name = 'AolError';
    this.signal = signalName;
    this.code = signal.code;
    this.exitCode = signal.exit;
  }
}
