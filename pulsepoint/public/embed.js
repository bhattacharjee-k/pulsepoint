/**
 * PulsePoint embeddable widget (demo build).
 * Hand-maintained plain-JS mirror of widget/src/embed.ts (no build step in this repo).
 * Renders in a Shadow DOM so host-page styles can't leak in or out. Uses the PulsePoint
 * design language (Noto Sans, design-system components) with the tenant's accent color.
 */
(function () {
  var script = document.currentScript;
  var publicKey = (script && script.dataset.publicKey) || '';
  var apiBase = (script && script.dataset.apiBase) || 'http://localhost:3000/api/v1';
  var submitter = {
    externalId: script && script.dataset.submitterExternalId,
    email: script && script.dataset.submitterEmail,
    displayName: script && script.dataset.submitterName
  };

  // Self-load Noto Sans so typography matches PulsePoint even on a bare host page.
  function loadFont() {
    if (document.getElementById('pp-font')) return;
    var link = document.createElement('link');
    link.id = 'pp-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  function styles(accent) {
    return [
      ':host { all: initial; }',
      '.pp-root, .pp-root * { box-sizing: border-box; font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }',
      '.pp-launcher { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; cursor: pointer; background: ' + accent + '; color: #fff; padding: 12px 18px; font-size: 14px; font-weight: 600; line-height: 1; box-shadow: 0 10px 30px rgba(16,24,40,0.22); transition: transform .15s ease, box-shadow .15s ease; }',
      '.pp-launcher:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(16,24,40,0.28); }',
      '.pp-launcher svg { width: 18px; height: 18px; }',
      '.pp-panel { position: fixed; right: 20px; bottom: 84px; z-index: 2147483000; width: min(380px, calc(100vw - 32px)); background: #fff; color: #101828; border: 1px solid #e4e7ec; border-radius: 14px; box-shadow: 0 24px 60px rgba(16,24,40,0.24); overflow: hidden; display: none; }',
      '.pp-panel.pp-open { display: block; }',
      '.pp-header { padding: 16px 18px; border-bottom: 1px solid #f2f4f7; }',
      '.pp-title { margin: 0; font-size: 16px; font-weight: 600; color: #101828; }',
      '.pp-sub { margin: 3px 0 0; font-size: 12px; color: #667085; }',
      '.pp-body { padding: 16px 18px; display: grid; gap: 12px; }',
      '.pp-field { display: grid; gap: 6px; }',
      '.pp-field.pp-hidden { display: none; }',
      '.pp-label { font-size: 12px; font-weight: 600; color: #475467; }',
      '.pp-input, .pp-select, .pp-textarea { width: 100%; border: 1px solid #d0d5dd; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #101828; background: #fff; }',
      '.pp-input:focus, .pp-select:focus, .pp-textarea:focus { outline: none; border-color: ' + accent + '; box-shadow: 0 0 0 3px ' + accent + '33; }',
      '.pp-textarea { min-height: 96px; resize: vertical; }',
      '.pp-captcha { font-size: 12px; color: #98a2b3; border: 1px dashed #d0d5dd; border-radius: 8px; padding: 9px 12px; text-align: center; }',
      '.pp-submit { border: 0; border-radius: 8px; cursor: pointer; width: 100%; background: ' + accent + '; color: #fff; padding: 11px 12px; font-size: 14px; font-weight: 600; }',
      '.pp-submit:disabled { opacity: .6; cursor: default; }',
      '.pp-status { font-size: 13px; color: #475467; min-height: 18px; margin: 0; }',
      '.pp-status.pp-error { color: #b42318; }',
      '.pp-footer { padding: 10px 18px 14px; font-size: 11px; color: #98a2b3; text-align: center; }'
    ].join('\n');
  }

  function markup(config, options) {
    return (
      '<div class="pp-root">' +
      '<button class="pp-launcher" type="button" aria-label="Open feedback">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      'Feedback</button>' +
      '<form class="pp-panel" novalidate>' +
      '<div class="pp-header"><p class="pp-title">' + config.promptText + '</p><p class="pp-sub">We read every submission.</p></div>' +
      '<div class="pp-body">' +
      '<div class="pp-field"><label class="pp-label" for="pp-type">Type</label><select class="pp-select" id="pp-type" name="type">' + options + '</select></div>' +
      '<div class="pp-field pp-hidden" data-rating><label class="pp-label" for="pp-rating">Rating (1–5)</label><input class="pp-input" id="pp-rating" name="rating" type="number" min="1" max="5" /></div>' +
      '<div class="pp-field"><label class="pp-label" for="pp-message">Message</label><textarea class="pp-textarea" id="pp-message" name="message" maxlength="5000" placeholder="What’s on your mind?"></textarea></div>' +
      '<div class="pp-field"><label class="pp-label" for="pp-email">Email (optional)</label><input class="pp-input" id="pp-email" name="contactEmail" type="email" placeholder="you@company.com" /></div>' +
      '<div class="pp-captcha">Protected by CAPTCHA</div>' +
      '<button class="pp-submit" type="submit">Send feedback</button>' +
      '<p class="pp-status" role="status"></p>' +
      '</div>' +
      '<div class="pp-footer">Powered by PulsePoint</div>' +
      '</form>' +
      '</div>'
    );
  }

  function mount(config) {
    loadFont();
    var accent = config.accentColor || '#4678ec';
    var options = (config.enabledTypes || [])
      .map(function (type) {
        return '<option value="' + type + '">' + type + '</option>';
      })
      .join('');

    var host = document.createElement('div');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + styles(accent) + '</style>' + markup(config, options);

    var launcher = root.querySelector('.pp-launcher');
    var panel = root.querySelector('.pp-panel');
    var status = root.querySelector('.pp-status');
    var submit = root.querySelector('.pp-submit');
    var typeSelect = root.querySelector('[name="type"]');
    var ratingField = root.querySelector('[data-rating]');

    function syncRating() {
      ratingField.classList.toggle('pp-hidden', typeSelect.value !== 'rating');
    }
    syncRating();
    typeSelect.addEventListener('change', syncRating);
    launcher.addEventListener('click', function () {
      panel.classList.toggle('pp-open');
    });

    panel.addEventListener('submit', function (event) {
      event.preventDefault();
      status.className = 'pp-status';
      status.textContent = 'Sending…';
      submit.disabled = true;
      var data = new FormData(panel);
      var ratingText = String(data.get('rating') || '');
      var payload = {
        type: data.get('type'),
        message: String(data.get('message') || '') || undefined,
        rating: ratingText ? Number(ratingText) : undefined,
        contactEmail: String(data.get('contactEmail') || '') || undefined,
        captchaToken: 'stub',
        submitter: submitter,
        context: { pageUrl: location.href, userAgent: navigator.userAgent, referrer: document.referrer }
      };
      fetch(apiBase + '/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Key': publicKey },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (response.ok) {
            status.textContent = 'Thanks — your feedback was sent.';
            panel.reset();
            syncRating();
          } else {
            status.className = 'pp-status pp-error';
            status.textContent = 'Could not send feedback. Please try again.';
          }
        })
        .catch(function () {
          status.className = 'pp-status pp-error';
          status.textContent = 'Could not send feedback. Please try again.';
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
  }

  fetch(apiBase + '/public/widget-config?key=' + encodeURIComponent(publicKey))
    .then(function (r) {
      if (!r.ok) throw new Error('Widget unavailable');
      return r.json();
    })
    .then(mount)
    .catch(function () {
      /* If config can't load, the widget stays hidden rather than breaking the host page. */
    });
})();
