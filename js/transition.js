/* ==========================================================================
   ZONE ENTRY
   Navigation reads as crossing a blue line into the next zone.

   Two implementations, one behaviour:
   - Cross document View Transitions where supported. The browser does the
     work off the main thread and the old page never blanks.
   - A JS driven sweep everywhere else.

   Rules it must not break, because a transition that eats a middle click is
   worse than no transition:
   - modifier clicks, middle clicks, downloads, targets and external links
     are left completely alone
   - reduced motion navigates instantly
   - if anything throws, the link still works: navigation is never awaited
   - total budget 280ms, because past that it is a loading screen
   ========================================================================== */
(function (C) {
  'use strict';

  var OUT = 280;

  C.ready(function () {
    var supportsVT = typeof document.startViewTransition === 'function' &&
                     CSS.supports('view-transition-name: none');

    function motionOff() {
      var pref = document.documentElement.getAttribute('data-motion');
      if (pref === 'reduced') return true;
      if (pref === 'full') return false;
      return C.prefersReduced();
    }

    /* Native cross document transitions are declared in CSS. Nothing to do
       here but let them run. */
    if (supportsVT) {
      document.documentElement.classList.add('has-vt');
      return;
    }

    var sweep = document.createElement('div');
    sweep.className = 'zone-sweep';
    sweep.setAttribute('aria-hidden', 'true');
    sweep.innerHTML = '<span class="zone-sweep__blue"></span>' +
                      '<span class="zone-sweep__red"></span>' +
                      '<span class="zone-sweep__fill"></span>';
    document.body.appendChild(sweep);

    /* Arriving: the sweep is already off screen, so play it in reverse once
       so entering a page mirrors leaving one. */
    if (!motionOff()) {
      sweep.setAttribute('data-state', 'in');
      setTimeout(function () { sweep.removeAttribute('data-state'); }, 460);
    }

    function leaving(href) {
      sweep.setAttribute('data-state', 'out');
      // Navigation is scheduled independently of the animation. If the
      // animation stalls the page still goes.
      setTimeout(function () { location.href = href; }, OUT);
    }

    C.on(document, 'click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

      var link = ev.target.closest('a[href]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      if (link.getAttribute('href').charAt(0) === '#') return;
      if (link.origin !== location.origin) return;
      if (link.pathname === location.pathname && link.search === location.search) return;
      if (motionOff()) return;

      ev.preventDefault();
      if (C.sfx) C.sfx.play('whoosh');
      leaving(link.href);
    });

    // Coming back through history must not leave the curtain down.
    C.on(window, 'pageshow', function () { sweep.removeAttribute('data-state'); });
  });
})(window.CANES);
