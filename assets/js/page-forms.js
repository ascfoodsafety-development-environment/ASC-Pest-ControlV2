/* ASC Pest Control — sub-page form handling
   Validates required fields, shows success message, submits to API if available. */
(function () {
  'use strict';

  var API = (window.ASC_API_BASE || '').replace(/\/$/, '');

  function handleForm(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok = true;
      form.querySelectorAll('[required]').forEach(function (el) {
        var bad = !el.value.trim();
        el.style.borderColor = bad ? 'var(--danger, #e53e3e)' : '';
        if (bad) ok = false;
      });
      if (!ok) {
        var first = form.querySelector('[required][style*="border-color: var(--danger"]');
        if (!first) first = form.querySelector('[required]');
        if (first) first.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
      }

      /* best-effort API post */
      if (API) {
        try {
          var fd = new FormData(form);
          var data = {};
          fd.forEach(function (v, k) { data[k] = v; });
          fetch(API + '/v1/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'web_form', data: data }),
          }).catch(function () {});
        } catch (err) { /* offline */ }
      }

      /* success state */
      if (btn) {
        btn.textContent = "Thank you — we'll be in touch within one business day!";
        btn.style.background = '#16a34a';
        btn.style.color = '#fff';
      }
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        el.disabled = true;
      });
    });
  }

  document.querySelectorAll('.pg-form').forEach(handleForm);
})();
