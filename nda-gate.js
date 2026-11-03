// ---------------------------------------------------------------------
// Password gate for NDA case studies. The page body ships encrypted
// (see _tools/build-nda.mjs); this derives the key from the password,
// decrypts the body and renders it. The derived key is remembered in
// localStorage so the other case studies open without retyping.
// ---------------------------------------------------------------------
(function () {
  var STORAGE_KEY = 'nda-key';
  var payloadEl = document.getElementById('nda-payload');
  if (!payloadEl) return;
  var payload = JSON.parse(payloadEl.textContent);

  function fromB64(s) {
    return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); });
  }

  function toB64(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }

  function deriveKey(password) {
    return crypto.subtle
      .importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(payload.salt), iterations: payload.iter },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt']
        );
      });
  }

  function decrypt(key) {
    return crypto.subtle
      .decrypt({ name: 'AES-GCM', iv: fromB64(payload.iv) }, key, fromB64(payload.ct))
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }

  function remember(key) {
    return crypto.subtle.exportKey('raw', key).then(function (raw) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ salt: payload.salt, key: toB64(raw) }));
      } catch (e) {}
    });
  }

  function storedKey() {
    var stored;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {}
    if (!stored || stored.salt !== payload.salt) return Promise.reject();
    return crypto.subtle.importKey('raw', fromB64(stored.key), 'AES-GCM', true, ['decrypt']);
  }

  // innerHTML doesn't run <script> tags, so swap each one for a fresh
  // element. async=false keeps external scripts in document order.
  function render(html) {
    payloadEl.remove();
    document.body.insertAdjacentHTML('afterbegin', html);
    document.documentElement.classList.add('pw-unlocked');
    document.body.querySelectorAll('script').forEach(function (old) {
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) { s.setAttribute(a.name, a.value); });
      if (old.src) s.async = false;
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  function buildGate() {
    var overlay = document.createElement('div');
    overlay.className = 'pw-gate-overlay';
    overlay.innerHTML =
      '<div class="pw-gate-card">' +
        '<p class="pw-gate-eyebrow">Password protected</p>' +
        '<h1 class="pw-gate-title">This case study is under NDA</h1>' +
        '<p class="pw-gate-subtitle">Enter the password to view it.</p>' +
        '<form class="pw-gate-form">' +
          '<input class="pw-gate-input" type="password" placeholder="Password" autocomplete="off" aria-label="Password" />' +
          '<button class="pw-gate-btn" type="submit">Unlock</button>' +
        '</form>' +
        '<p class="pw-gate-error" hidden>That password isn\'t right. Try again.</p>' +
        '<a class="pw-gate-back link-accent" href="index.html#work">&larr; Back to portfolio</a>' +
      '</div>';
    document.body.appendChild(overlay);

    var form = overlay.querySelector('.pw-gate-form');
    var input = overlay.querySelector('.pw-gate-input');
    var button = overlay.querySelector('.pw-gate-btn');
    var error = overlay.querySelector('.pw-gate-error');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      button.disabled = true;
      error.hidden = true;
      deriveKey(input.value)
        .then(function (key) {
          return decrypt(key).then(function (html) {
            overlay.remove();
            render(html);
            return remember(key);
          });
        })
        .catch(function () {
          error.hidden = false;
          input.value = '';
          input.focus();
        })
        .then(function () {
          button.disabled = false;
        });
    });

    setTimeout(function () {
      input.focus();
    }, 50);
  }

  storedKey()
    .then(decrypt)
    .then(render)
    .catch(function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      buildGate();
    });
})();
