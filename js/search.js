/* ==========================================================================
   SEARCH
   Client side, over an index generated at build time. The whole index is a
   few kilobytes, so there is no server round trip and no third party.

   Fetched lazily on first open: a visitor who never searches never pays for
   it. Results are ranked title first, then section, then body.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    var overlay = C.qs('[data-search]');
    var trigger = C.qs('[data-search-trigger]');
    if (!overlay || !trigger) return;

    var input = C.qs('input', overlay);
    var list = C.qs('[data-search-results]');
    var status = C.qs('[data-search-status]');
    var trap = C.trapFocus(overlay);
    var index = null;
    var loading = false;

    function load() {
      if (index || loading) return Promise.resolve();
      loading = true;
      var base = document.documentElement.getAttribute('data-basepath') || '';
      return fetch(base + 'data/search-index.json')
        .then(function (r) { return r.json(); })
        .then(function (json) { index = json; loading = false; })
        .catch(function () {
          loading = false;
          if (status) status.textContent = 'Search is unavailable offline.';
        });
    }

    function score(entry, q) {
      var t = (entry.title || '').toLowerCase();
      var s = (entry.section || '').toLowerCase();
      var b = (entry.text || '').toLowerCase();
      if (t.indexOf(q) === 0) return 100;
      if (t.indexOf(q) > -1) return 70;
      if (s.indexOf(q) > -1) return 40;
      if (b.indexOf(q) > -1) return 20;
      return 0;
    }

    function snippet(entry, q) {
      var text = entry.text || '';
      var i = text.toLowerCase().indexOf(q);
      if (i < 0) return text.slice(0, 120);
      return (i > 30 ? '...' : '') + text.slice(Math.max(0, i - 30), i + 90);
    }

    function render(q) {
      if (!index || !list) return;
      q = q.trim().toLowerCase();
      if (q.length < 2) {
        list.innerHTML = '';
        if (status) status.textContent = 'Type at least two characters.';
        return;
      }
      var lang = document.documentElement.lang || 'en';
      var hits = index
        .filter(function (x) { return x.lang === lang; })
        .map(function (x) { return { x: x, s: score(x, q) }; })
        .filter(function (h) { return h.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 8);

      list.innerHTML = hits.map(function (h) {
        return '<li><a class="sresult" href="' + h.x.url + '">' +
          '<span class="mono">' + h.x.section + '</span>' +
          '<span class="sresult__title">' + h.x.title + '</span>' +
          '<span class="sresult__snip">' + snippet(h.x, q) + '</span></a></li>';
      }).join('');

      if (status) {
        status.textContent = hits.length
          ? hits.length + (hits.length === 1 ? ' result' : ' results')
          : 'Nothing found for that.';
      }
    }

    function setOpen(open) {
      overlay.setAttribute('data-open', String(open));
      overlay.setAttribute('aria-hidden', String(!open));
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        document.body.setAttribute('data-lock', 'search');
        document.addEventListener('keydown', trap);
        load().then(function () { render(input.value); });
        setTimeout(function () { input.focus(); }, 60);
      } else {
        document.body.removeAttribute('data-lock');
        document.removeEventListener('keydown', trap);
        trigger.focus();
      }
    }

    C.on(trigger, 'click', function () { setOpen(overlay.getAttribute('data-open') !== 'true'); });
    C.on(C.qs('[data-search-close]', overlay), 'click', function () { setOpen(false); });
    C.on(input, 'input', function () { render(input.value); });

    C.on(document, 'keydown', function (ev) {
      if (ev.key === 'Escape' && overlay.getAttribute('data-open') === 'true') setOpen(false);
      // Slash opens search, the convention people already know, but never
      // while they are typing somewhere else.
      var typing = /input|textarea|select/i.test((ev.target.tagName || ''));
      if (ev.key === '/' && !typing && overlay.getAttribute('data-open') !== 'true') {
        ev.preventDefault();
        setOpen(true);
      }
    });
  });
})(window.CANES);
