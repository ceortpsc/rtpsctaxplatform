// Progressive enhancement for the web portal. Forms work without JS (server
// redirects on form-encoded posts); with JS, they submit as JSON and show toasts.

(function () {
  'use strict';

  function toast(message, isError) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' err' : '');
    setTimeout(function () {
      el.className = 'toast';
    }, 3200);
  }

  function formToPayload(form) {
    var fd = new FormData(form);
    var arrayKeys = (form.getAttribute('data-array') || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    var payload = {};
    var keys = {};
    fd.forEach(function (_value, key) { keys[key] = true; });
    Object.keys(keys).forEach(function (key) {
      payload[key] = arrayKeys.indexOf(key) >= 0 ? fd.getAll(key) : fd.get(key);
    });
    return payload;
  }

  async function submitForm(event) {
    var form = event.currentTarget;
    var api = form.getAttribute('data-api');
    if (!api) return;
    event.preventDefault();
    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      var response = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
        body: JSON.stringify(formToPayload(form))
      });
      var data = await response.json();
      if (response.ok && data.ok !== false) {
        toast('Success.');
        var redirectTo = form.getAttribute('data-redirect');
        if (redirectTo) {
          setTimeout(function () { window.location.href = redirectTo; }, 500);
        } else {
          setTimeout(function () { window.location.reload(); }, 500);
        }
      } else {
        toast(data.message || 'Request failed.', true);
        if (button) button.disabled = false;
      }
    } catch (err) {
      toast('Network error.', true);
      if (button) button.disabled = false;
    }
  }

  async function signout(event) {
    event.preventDefault();
    try {
      await fetch('/api/signout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
        body: '{}'
      });
    } catch (err) { /* ignore */ }
    window.location.href = '/';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form[data-api]');
    for (var i = 0; i < forms.length; i += 1) {
      forms[i].addEventListener('submit', submitForm);
    }
    var outButtons = document.querySelectorAll('[data-signout]');
    for (var j = 0; j < outButtons.length; j += 1) {
      outButtons[j].addEventListener('click', signout);
    }
  });
})();
