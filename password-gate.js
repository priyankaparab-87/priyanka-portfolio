(function () {
  var PASSWORD = 'pri_port26';
  var STORAGE_KEY = 'portfolio-unlocked';

  function isUnlocked() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  if (isUnlocked()) {
    document.documentElement.classList.add('pw-unlocked');
    return;
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
          '<input class="pw-gate-input" type="password" placeholder="Password" autocomplete="off" />' +
          '<button class="pw-gate-btn" type="submit">Unlock</button>' +
        '</form>' +
        '<p class="pw-gate-error" hidden>That password isn\'t right. Try again.</p>' +
        '<a class="pw-gate-back link-accent" href="index.html#work">&larr; Back to portfolio</a>' +
      '</div>';
    document.body.appendChild(overlay);

    var form = overlay.querySelector('.pw-gate-form');
    var input = overlay.querySelector('.pw-gate-input');
    var error = overlay.querySelector('.pw-gate-error');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === PASSWORD) {
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}
        document.documentElement.classList.add('pw-unlocked');
        overlay.remove();
      } else {
        error.hidden = false;
        input.value = '';
        input.focus();
      }
    });

    setTimeout(function () {
      input.focus();
    }, 50);
  }

  if (document.body) {
    buildGate();
  } else {
    document.addEventListener('DOMContentLoaded', buildGate);
  }
})();
