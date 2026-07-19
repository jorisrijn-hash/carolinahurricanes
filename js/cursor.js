/* ==========================================================================
   CURSOR
   A dot and a ring. Nothing literal.

   It still earns the frame loop by signalling affordance: the ring opens on
   anything interactive and fills on press, so hit targets read before the
   click. It no longer spells the action out, which was louder than the rest
   of the interface deserved.

   Fine pointers only. Off under reduced motion. Toggleable in settings.
   The system caret is never hidden over text or form fields.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;

    function motionOff() {
      var pref = document.documentElement.getAttribute('data-motion');
      if (pref === 'reduced') return true;
      if (pref === 'full') return false;
      return C.prefersReduced();
    }

    function active() {
      return C.prefs && C.prefs.get('cursor') !== false && !motionOff();
    }

    var el = document.createElement('div');
    el.className = 'dot-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="dot-cursor__dot"></span>' +
                   '<span class="dot-cursor__ring"></span>';
    document.body.appendChild(el);

    var x = -100, y = -100, cx = x, cy = y, shown = false;

    C.on(window, 'pointermove', function (ev) {
      x = ev.clientX; y = ev.clientY;
      if (!shown && active()) {
        shown = true;
        document.documentElement.classList.add('has-dot');
      }
    }, { passive: true });

    C.on(document, 'pointerover', function (ev) {
      if (!active()) return;
      var t = ev.target;
      // Text entry keeps the system caret. A puck over an input is useless.
      if (t.closest('input, textarea, select, [contenteditable]')) {
        el.setAttribute('data-mode', 'off');
        return;
      }
      el.setAttribute('data-mode',
        t.closest('a, button, .chip, .switch, [data-fav], summary, label') ? 'hot' : 'idle');
    });

    C.on(document, 'pointerdown', function () { el.setAttribute('data-press', 'true'); });
    C.on(document, 'pointerup', function () { el.removeAttribute('data-press'); });
    C.on(document, 'pointerleave', function () {
      document.documentElement.classList.remove('has-dot');
      shown = false;
    });

    C.loop(function () {
      if (!shown) return;
      // A touch of lag so it trails rather than sticks.
      cx = C.lerp(cx, x, 0.28);
      cy = C.lerp(cy, y, 0.28);
      el.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    });

    C.on(document, 'canes:prefs', function () {
      document.documentElement.classList.toggle('has-dot', active() && shown);
    });
  });
})(window.CANES);
