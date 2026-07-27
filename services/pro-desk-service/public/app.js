const $ = (sel) => document.querySelector(sel);

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(n)
  );
}

async function getJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || body.error || res.statusText);
  return body;
}

function bindTabs() {
  const tabs = [...document.querySelectorAll('.tab')];
  const panels = [...document.querySelectorAll('.panel')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.panel;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => {
        const on = p.dataset.panel === id;
        p.hidden = !on;
        p.classList.toggle('active', on);
      });
      history.replaceState(null, '', `#${id}`);
    });
  });

  const hash = (location.hash || '#scorecard').slice(1);
  const match = tabs.find((t) => t.dataset.panel === hash);
  if (match) match.click();
}

async function loadScorecard() {
  const card = await getJson('/api/scorecard');
  const hero = $('#scoreHero');
  hero.innerHTML = `
    <div class="score-index">${card.index}</div>
    <div class="score-meta">
      <strong>${card.verdict.replaceAll('_', ' ')}</strong>
      <p>${card.headline}</p>
      <p>${card.summary.ahead} ahead · ${card.summary.building} building · vs ${card.competitor.label}</p>
    </div>
  `;

  const matrix = $('#matrix');
  matrix.innerHTML = card.rows
    .map(
      (row) => `
      <div class="matrix-row" role="row">
        <h3>${row.area}</h3>
        <p><strong>Pro-class:</strong> ${row.competitor}</p>
        <p><strong>RTPSC:</strong> ${row.rtpsc}</p>
        <span class="badge ${row.posture}">${row.posture}</span>
      </div>
    `
    )
    .join('');
}

async function loadGuardrails() {
  const data = await getJson('/api/guardrails');
  const list = $('#guardList');
  const items = [
    ...data.aiHardProhibitions.map((p) => `AI hard prohibition: ${p.replaceAll('_', ' ')}`),
    data.efileNotice,
    ...(data.envProtection?.reasons || [])
  ];
  list.innerHTML = items.map((t) => `<li>${t}</li>`).join('');
}

async function loadOps() {
  const data = await getJson('/api/ops');
  $('#opsList').innerHTML = data.links
    .map((l) => `<li><a href="${l.href}" target="_blank" rel="noopener">${l.label}</a> · :${l.port}</li>`)
    .join('');
}

function formPayload(form) {
  const fd = new FormData(form);
  const documents = ['1040'];
  if (fd.get('doc8867')) documents.push('8867');
  if (fd.get('docW2')) documents.push('w2');
  return {
    displayName: fd.get('displayName'),
    taxpayerRef: fd.get('taxpayerRef'),
    filingStatus: fd.get('filingStatus'),
    qualifyingChildren: Number(fd.get('qualifyingChildren') || 0),
    wages: Number(fd.get('wages') || 0),
    withholding: Number(fd.get('withholding') || 0),
    selfEmployment: Number(fd.get('selfEmployment') || 0),
    taxLiability: Number(fd.get('taxLiability') || 0),
    claimEitc: Boolean(fd.get('claimEitc')),
    claimActc: Boolean(fd.get('claimActc')),
    spousePresent: Boolean(fd.get('spousePresent')),
    qualifyingPerson: Boolean(fd.get('qualifyingPerson')),
    documents
  };
}

function renderPrepOut(result) {
  const d = result.diagnostics;
  const findings = (d.findings || [])
    .map(
      (f) =>
        `<li><span class="sev-${f.severity}">${f.severity}</span> <code>${f.code}</code> — ${f.message}</li>`
    )
    .join('');
  const opt = d.optimization
    ? `<p>ROI baseline ${money(d.optimization.baselineRefund)} → optimized ${money(
        d.optimization.optimizedRefund
      )}</p><p>${d.optimization.topBoost || ''}</p>`
    : '';
  $('#prepOut').innerHTML = `
    <div class="diag-block">
      <h3>${result.return.answers.displayName || 'Return'} · ${result.return.stage}</h3>
      <p>Errors ${d.counts.errors} · Warnings ${d.counts.warnings} · Ready to e-file: <strong>${
        d.readyToEfile ? 'yes' : 'no'
      }</strong></p>
      <p>Refund math (heuristic): ${money(d.refundMath?.refund)}</p>
      ${opt}
    </div>
    <ul class="findings">${findings || '<li>No findings — clear for human review.</li>'}</ul>
  `;
}

function bindPrep() {
  $('#prepForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = $('#prepOut');
    out.textContent = 'Running interview + diagnostics…';
    try {
      const payload = formPayload(event.target);
      const created = await getJson('/api/prep/returns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await getJson(`/api/prep/returns/${encodeURIComponent(created.id)}/interview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const diagnosed = await getJson(`/api/prep/returns/${encodeURIComponent(created.id)}/diagnostics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
      renderPrepOut(diagnosed);
    } catch (error) {
      out.textContent = error.message;
    }
  });
}

bindTabs();
bindPrep();
loadScorecard().catch((e) => {
  $('#scoreHero').textContent = e.message;
});
loadGuardrails().catch(() => {});
loadOps().catch(() => {});
