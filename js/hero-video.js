/* ==========================================================================
   HERO VIDEO
   The video is opt-in by default, not opt-out. Nothing downloads until the
   client has been checked, so a visitor on a metered connection, a reduced
   motion setting or data saver pays nothing and sees the poster instead.

   WCAG 2.2.2: content that moves for more than five seconds must be
   pausable, so there is a real control, not a hidden one.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    var video = C.qs('[data-hero-video]');
    if (!video) return;

    var toggle = C.qs('[data-hero-toggle]');
    var label = toggle ? C.qs('[data-hero-toggle-label]', toggle) : null;

    function motionOff() {
      var pref = document.documentElement.getAttribute('data-motion');
      if (pref === 'reduced') return true;
      if (pref === 'full') return false;
      return C.prefersReduced();
    }

    function shouldLoad() {
      if (document.documentElement.classList.contains('data-saver')) return false;
      if (motionOff()) return false;
      var conn = navigator.connection;
      if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return false;
      return true;
    }

    /* Sources are attached here rather than in the markup. A <source> in the
       HTML starts fetching before any of the checks above can run. */
    function attach() {
      if (video.dataset.loaded) return;
      var wide = window.matchMedia('(min-width: 1100px)').matches &&
                 window.devicePixelRatio >= 1;
      var base = 'assets/video/hero-' + (wide ? '1080' : '720');
      var webm = document.createElement('source');
      webm.type = 'video/webm';
      webm.src = 'assets/video/hero-720.webm';
      var mp4 = document.createElement('source');
      mp4.type = 'video/mp4';
      mp4.src = base + '.mp4';
      video.appendChild(webm);
      video.appendChild(mp4);
      video.dataset.loaded = '1';
      video.load();
    }

    function setState(playing) {
      video.classList.toggle('is-playing', playing);
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(playing));
        if (label) label.textContent = playing ? 'Pause' : 'Play';
      }
    }

    function start() {
      attach();
      var p = video.play();
      if (p && p.catch) {
        // Autoplay can still be refused. That is a valid state, not an error:
        // the poster stays and the control offers to start it.
        p.then(function () { setState(true); })
         .catch(function () { setState(false); });
      } else {
        setState(true);
      }
    }

    if (shouldLoad()) {
      // Wait for the hero to be on screen and the page to settle, so the
      // video never competes with the first paint.
      C.whileVisible(video, function () {
        if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
        else setTimeout(start, 600);
      }, function () { if (!video.paused) { video.pause(); setState(false); } });
    } else {
      setState(false);
    }

    if (toggle) {
      C.on(toggle, 'click', function () {
        if (video.paused) start();
        else { video.pause(); setState(false); }
      });
    }

    // Never burn decode cycles in a background tab.
    C.on(document, 'visibilitychange', function () {
      if (document.hidden && !video.paused) video.pause();
    });

    // Settings changes take effect without a reload.
    C.on(document, 'canes:prefs', function () {
      if (!shouldLoad() && !video.paused) { video.pause(); setState(false); }
    });
  });
})(window.CANES);
