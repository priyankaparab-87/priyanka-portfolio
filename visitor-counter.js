// ---------------------------------------------------------------------
// Floating visitor counter for case study pages. Reads the shared hit
// count from Abacus (free, no-auth counting API: abacus.jasoncameron.dev)
// and increments it once per browser session per page.
// ---------------------------------------------------------------------
(function () {
  const NAMESPACE = 'priyankaparab-87-portfolio';

  const el = document.getElementById('visitorCounter');
  if (!el) return;

  const key = el.getAttribute('data-visitor-key');
  const valueEl = el.querySelector('.visitor-counter-value');
  if (!key || !valueEl) return;

  const sessionFlag = 'visitorCounted:' + key;
  let alreadyCounted = false;
  try {
    alreadyCounted = !!sessionStorage.getItem(sessionFlag);
  } catch (e) {
    // storage unavailable (private mode, etc.) — fall back to always hitting
  }

  const endpoint = alreadyCounted ? 'get' : 'hit';

  fetch('https://abacus.jasoncameron.dev/' + endpoint + '/' + NAMESPACE + '/' + key)
    .then((res) => {
      if (!res.ok) throw new Error('bad response');
      return res.json();
    })
    .then((data) => {
      if (typeof data.value !== 'number') throw new Error('bad payload');
      valueEl.textContent = data.value.toLocaleString();
      el.classList.add('is-loaded');
      if (!alreadyCounted) {
        try {
          sessionStorage.setItem(sessionFlag, '1');
        } catch (e) {
          // ignore
        }
      }
    })
    .catch(() => {
      el.classList.add('is-hidden');
    });
})();
