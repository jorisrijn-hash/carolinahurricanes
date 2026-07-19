/* ==========================================================================
   BOOT SEQUENCE
   A National Weather Service advisory prints line by line while the scope
   acquires lock, then a shutter wipes up. Budget: ~2.2s.

   Rules:
   - Skipped entirely under prefers-reduced-motion.
   - Shown once per session, not on every navigation.
   - Any key, click or the skip control ends it immediately.
   - Content underneath is never hidden from assistive tech: the overlay is
     aria-hidden and the page below stays in the accessibility tree.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    var boot = C.qs('[data-boot]');
    if (!boot) return;

    var body = document.body;
    var seen = false;
    try { seen = sessionStorage.getItem('canes:booted') === '1'; } catch (e) { /* private mode */ }

    /* Opt in only. The intro is a campaign asset, not a toll booth on the
       score. It runs when the page opts in or a link asks for it. */
    var wanted = document.documentElement.hasAttribute('data-boot-enabled') ||
                 /[?&]intro=1/.test(location.search);
    if (!wanted || seen || C.prefersReduced()) { boot.hidden = true; return; }
    boot.hidden = false;

    body.setAttribute('data-lock', 'boot');

    var bar = C.qs('.boot__bar span', boot);
    var lines = C.qsa('.boot__line', boot);
    var canvas = C.qs('canvas', boot);
    var done = false, stopLoop = null, t0 = performance.now();

    /* ---- scope: a sweep acquiring a target ------------------------------ */
    if (canvas) {
      var ctx = canvas.getContext('2d');
      stopLoop = C.loop(function (t) {
        var m = C.fitCanvas(canvas), w = m.w, h = m.h, d = m.dpr;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
        var e = (t - t0) / 1000;

        // range rings
        ctx.strokeStyle = 'rgba(58,65,73,.85)';
        ctx.lineWidth = 1;
        for (var i = 1; i <= 4; i++) {
          ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2); ctx.stroke();
        }
        // cross hairs
        ctx.beginPath();
        ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
        ctx.stroke();

        // sweep: a wedge with a decaying tail
        var ang = e * 2.4;
        var g = ctx.createConicGradient ? ctx.createConicGradient(ang, cx, cy) : null;
        if (g) {
          g.addColorStop(0, 'rgba(255,34,51,.55)');
          g.addColorStop(0.08, 'rgba(204,0,0,.16)');
          g.addColorStop(0.3, 'rgba(204,0,0,0)');
          g.addColorStop(1, 'rgba(204,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,34,51,.95)';
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
      });
    }

    /* ---- advisory print -------------------------------------------------- */
    lines.forEach(function (line, i) {
      setTimeout(function () { line.classList.add('is-on'); }, 180 + i * 210);
    });

    /* ---- progress -------------------------------------------------------- */
    var p = 0;
    var prog = setInterval(function () {
      p = Math.min(100, p + 9 + Math.random() * 11);
      if (bar) bar.style.setProperty('--p', p.toFixed(0) + '%');
      if (p >= 100) clearInterval(prog);
    }, 160);

    function finish() {
      if (done) return;
      done = true;
      clearInterval(prog);
      if (bar) bar.style.setProperty('--p', '100%');
      boot.classList.add('is-done');
      body.removeAttribute('data-lock');
      try { sessionStorage.setItem('canes:booted', '1'); } catch (e) {}
      document.documentElement.classList.add('is-booted');
      setTimeout(function () {
        boot.hidden = true;
        if (stopLoop) stopLoop();
      }, 1500);
    }

    setTimeout(finish, 2200);
    C.on(C.qs('[data-boot-skip]'), 'click', finish);
    C.on(document, 'keydown', function (e) { if (!done) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); } });
    C.on(boot, 'click', finish);
  });
})(window.CANES);
