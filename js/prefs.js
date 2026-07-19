/* ==========================================================================
   PREFERENCES
   One store for every user choice that outlives a page view: data saver,
   motion, language, followed players, saved games.

   Everything is local. No account, no cookie banner, no third party. The
   OS setting always wins on first visit; an explicit choice overrides it.
   ========================================================================== */
(function (C) {
  'use strict';

  var KEY = 'canes:prefs';
  var DEFAULTS = { dataSaver: false, motion: 'auto', lang: 'en',
                   cursor: true, sfx: false, follows: [], saved: [] };
  var state = null;

  function read() {
    if (state) return state;
    try { state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (err) { state = Object.assign({}, DEFAULTS); }
    return state;
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* full or blocked */ }
    document.dispatchEvent(new CustomEvent('canes:prefs', { detail: state }));
  }

  var Prefs = {
    all: read,
    get: function (k) { return read()[k]; },
    set: function (k, v) { read()[k] = v; write(); apply(); },
    toggleList: function (k, id) {
      var list = read()[k];
      var i = list.indexOf(id);
      if (i > -1) list.splice(i, 1); else list.push(id);
      write(); apply();
      return i < 0;
    },
    has: function (k, id) { return read()[k].indexOf(id) > -1; }
  };

  /* Data saver is the important one: it is the difference between a page
     that works on congested arena wifi and one that does not. It stops the
     canvases, drops decorative imagery and disables parallax. */
  function apply() {
    var p = read();
    var root = document.documentElement;
    root.classList.toggle('data-saver', !!p.dataSaver);
    root.setAttribute('data-motion', p.motion);
    C.qsa('[data-fav]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Prefs.has('follows', b.getAttribute('data-fav'))));
    });
    C.qsa('[data-pref-input]').forEach(function (input) {
      var k = input.getAttribute('data-pref-input');
      if (input.type === 'checkbox') input.checked = !!p[k];
      else input.value = p[k];
    });
  }

  C.prefs = Prefs;

  C.ready(function () {
    apply();

    /* ---- settings panel ---------------------------------------------- */
    var panel = C.qs('[data-settings]');
    var trigger = C.qs('[data-settings-trigger]');
    if (panel && trigger) {
      var trap = C.trapFocus(panel);
      function setOpen(open) {
        panel.setAttribute('data-open', String(open));
        panel.setAttribute('aria-hidden', String(!open));
        trigger.setAttribute('aria-expanded', String(open));
        if (open) {
          document.addEventListener('keydown', trap);
          var first = C.qs('input,button,select', panel);
          if (first) setTimeout(function () { first.focus(); }, 60);
        } else {
          document.removeEventListener('keydown', trap);
          trigger.focus();
        }
      }
      C.on(trigger, 'click', function () {
        setOpen(panel.getAttribute('data-open') !== 'true');
      });
      C.on(C.qs('[data-settings-close]', panel), 'click', function () { setOpen(false); });
      C.on(document, 'keydown', function (ev) {
        if (ev.key === 'Escape' && panel.getAttribute('data-open') === 'true') setOpen(false);
      });
    }

    C.qsa('[data-pref-input]').forEach(function (input) {
      C.on(input, 'change', function () {
        var k = input.getAttribute('data-pref-input');
        Prefs.set(k, input.type === 'checkbox' ? input.checked : input.value);
      });
    });

    /* ---- follow buttons ----------------------------------------------- */
    C.qsa('[data-fav]').forEach(function (btn) {
      C.on(btn, 'click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var now = Prefs.toggleList('follows', btn.getAttribute('data-fav'));
        var live = C.qs('[data-follow-live]');
        if (live) {
          live.textContent = (btn.getAttribute('aria-label') || '').replace('Follow ', '') +
            (now ? ' followed.' : ' unfollowed.');
        }
      });
    });
  });
})(window.CANES);
