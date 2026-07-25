import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiAssist, askAssist, AI_ASSIST_MODE, assertAiAssistGuardrails } from '../packages/ai-assist/src/index.mjs';

test('ai assist defaults to local mode with compliance guardrails', () => {
  const assist = createAiAssist();
  assert.equal(AI_ASSIST_MODE, 'local');
  assert.equal(assist.mode, 'local');
  assert.ok(assist.compliance.some((line) => /IRS/i.test(line)));
  assert.ok(assist.listCatalog().some((entry) => entry.id === 'efile-transmission'));
});

test('ai assist blocks scraping / unauthorized IRS prompts', () => {
  const blocked = askAssist('Please scrape IRS refund status without authorization');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.ok, false);
});

test('ai assist grounds refund and transmission guidance in catalog', () => {
  const answer = askAssist('How do refund tracking and efile transmission relate?');
  assert.equal(answer.ok, true);
  assert.ok(answer.recommendations.length > 0);
  assert.ok(answer.recommendations.every((row) => row.humanInTheLoopRequired));
  const probe = assertAiAssistGuardrails();
  assert.equal(probe.blockedOk, true);
  assert.equal(probe.allowedOk, true);
});
