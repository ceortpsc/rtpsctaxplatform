const personasEl = document.getElementById('personas');
const serviceSelect = document.getElementById('service-select');
const personaSelect = document.getElementById('persona-select');
const hireForm = document.getElementById('hire-form');
const hireOut = document.getElementById('hire-out');
const tasksEl = document.getElementById('tasks');
const eventsEl = document.getElementById('events');
const govEl = document.getElementById('gov');

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || 'request_failed'), { data, status: response.status });
  return data;
}

function show(el, data) {
  el.hidden = false;
  el.textContent = JSON.stringify(data, null, 2);
}

async function bootstrap() {
  const [gov, personas, catalog] = await Promise.all([
    getJson('/v1/governance'),
    getJson('/v1/personas'),
    getJson('/v1/catalog')
  ]);
  govEl.textContent = JSON.stringify(gov, null, 2);

  personasEl.innerHTML = personas.personas
    .map(
      (persona) => `<article class="card"><strong>${persona.name}</strong><span>${persona.title || persona.id} · risk ${persona.riskDefault} · ${persona.status}</span><span>Permitted: ${persona.permitted.slice(0, 2).join(', ')}</span></article>`
    )
    .join('');

  personaSelect.innerHTML = personas.personas
    .map((persona) => `<option value="${persona.id}">${persona.name}</option>`)
    .join('');

  serviceSelect.innerHTML = catalog.catalog
    .map((item) => `<option value="${item.code}">${item.code} — ${item.name} ($${item.price})</option>`)
    .join('');

  refreshBoard();
  setInterval(refreshBoard, 4000);
}

async function refreshBoard() {
  try {
    const [tasks, events] = await Promise.all([getJson('/v1/tasks'), getJson('/v1/events?limit=20')]);
    tasksEl.innerHTML = tasks.tasks.length
      ? tasks.tasks
          .slice(0, 12)
          .map(
            (task) => `<article class="task"><b>${task.state}</b> · ${task.serviceCode} · ${task.personaName}<br/><span>${task.clientReference} · ${task.paymentStatus} · $${task.price}</span></article>`
          )
          .join('')
      : '<p class="section-lede">No live tasks yet.</p>';
    eventsEl.textContent = JSON.stringify(events.events, null, 2);
  } catch (error) {
    eventsEl.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
}

hireForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(hireForm);
  try {
    const data = await getJson('/v1/live-service', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        serviceCode: form.get('serviceCode'),
        personaId: form.get('personaId'),
        clientReference: form.get('clientReference'),
        scopeNotes: form.get('scopeNotes') || '',
        autoHumanApprove: form.get('autoHumanApprove') === 'on'
      })
    });
    show(hireOut, data);
    refreshBoard();
  } catch (error) {
    show(hireOut, error.data || { error: error.message });
  }
});

bootstrap().catch((error) => {
  govEl.textContent = JSON.stringify({ error: error.message }, null, 2);
});
