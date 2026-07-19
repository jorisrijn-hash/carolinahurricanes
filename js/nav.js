/* ==========================================================================
   NAVIGATION
   Transparent over the hero, forged into steel on scroll, hides on scroll
   down and returns on scroll up. Mega panels are hover-or-click on pointer
   devices and always keyboard operable. Escape closes, focus returns.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    var nav = C.qs('[data-nav]');
    if (!nav) return;

    /* ---- sticky + hide-on-scroll-down ----------------------------------- */
    var last = window.scrollY, ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        nav.classList.toggle('is-stuck', y > 40);
        var openPanel = C.qs('[data-mega][data-open="true"]');
        var drawerOpen = C.qs('[data-drawer][data-open="true"]');
        // Never hide the bar while a menu is open or near the top.
        nav.setAttribute('data-hidden', String(y > 420 && y > last && !openPanel && !drawerOpen));
        last = y;
        ticking = false;
      });
    }
    C.on(window, 'scroll', onScroll, { passive: true });
    onScroll();

    /* ---- mega panels ----------------------------------------------------- */
    var triggers = C.qsa('[data-mega-trigger]');
    var closeTimer;

    function closeAll(except) {
      triggers.forEach(function (t) {
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (!panel || panel === except) return;
        panel.setAttribute('data-open', 'false');
        t.setAttribute('aria-expanded', 'false');
      });
    }

    triggers.forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      function open() {
        clearTimeout(closeTimer);
        closeAll(panel);
        panel.setAttribute('data-open', 'true');
        trigger.setAttribute('aria-expanded', 'true');
      }
      function close() {
        panel.setAttribute('data-open', 'false');
        trigger.setAttribute('aria-expanded', 'false');
      }
      function delayedClose() { closeTimer = setTimeout(close, 180); }

      C.on(trigger, 'click', function (e) {
        e.preventDefault();
        trigger.getAttribute('aria-expanded') === 'true' ? close() : open();
      });
      C.on(trigger, 'mouseenter', open);
      C.on(trigger, 'mouseleave', delayedClose);
      C.on(panel, 'mouseenter', function () { clearTimeout(closeTimer); });
      C.on(panel, 'mouseleave', delayedClose);
      C.on(trigger, 'focus', open);
      C.on(panel, 'focusout', function (e) {
        if (!panel.contains(e.relatedTarget) && e.relatedTarget !== trigger) close();
      });
    });

    C.on(document, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = C.qs('[data-mega][data-open="true"]');
      if (open) {
        var t = C.qs('[aria-controls="' + open.id + '"]');
        open.setAttribute('data-open', 'false');
        if (t) { t.setAttribute('aria-expanded', 'false'); t.focus(); }
      }
    });

    C.on(document, 'click', function (e) {
      if (!nav.contains(e.target)) closeAll(null);
    });

    /* ---- mobile drawer ---------------------------------------------------- */
    var burger = C.qs('[data-burger]');
    var drawer = C.qs('[data-drawer]');
    if (burger && drawer) {
      var trap = C.trapFocus(drawer);
      function setDrawer(open) {
        drawer.setAttribute('data-open', String(open));
        burger.setAttribute('aria-expanded', String(open));
        drawer.setAttribute('aria-hidden', String(!open));
        if (open) {
          document.body.setAttribute('data-lock', 'drawer');
          document.addEventListener('keydown', trap);
          var first = C.qs('a,button', drawer);
          if (first) setTimeout(function () { first.focus(); }, 60);
        } else {
          document.body.removeAttribute('data-lock');
          document.removeEventListener('keydown', trap);
          burger.focus();
        }
      }
      C.on(burger, 'click', function () {
        setDrawer(drawer.getAttribute('data-open') !== 'true');
      });
      C.on(document, 'keydown', function (e) {
        if (e.key === 'Escape' && drawer.getAttribute('data-open') === 'true') setDrawer(false);
      });
      C.qsa('a', drawer).forEach(function (a) { C.on(a, 'click', function () { setDrawer(false); }); });

      // Accordion groups inside the drawer.
      C.qsa('[data-drawer-toggle]', drawer).forEach(function (t) {
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        C.on(t, 'click', function () {
          var open = t.getAttribute('aria-expanded') === 'true';
          t.setAttribute('aria-expanded', String(!open));
          if (panel) panel.setAttribute('data-open', String(!open));
        });
      });
    }
  });
})(window.CANES);
