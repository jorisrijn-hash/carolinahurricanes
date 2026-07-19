/* ==========================================================================
   GAME CENTER
   Draws the momentum line on scroll and staggers the shot map so the marks
   land rather than appear. No polling here: wiring to a live feed replaces
   the sample markup, it does not change this file.
   ========================================================================== */
(function (C) {
  'use strict';
  C.ready(function () {
    var reduced = C.prefersReduced();

    /* ---- momentum line draws itself in ---------------------------------- */
    var line = C.qs('[data-mom-line]');
    var area = C.qs('[data-mom-area]');
    if (line && !reduced && 'IntersectionObserver' in window) {
      var len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      if (area) area.style.opacity = '0';
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        line.style.transition = 'stroke-dashoffset 1600ms cubic-bezier(.16,1,.3,1)';
        line.style.strokeDashoffset = '0';
        if (area) {
          area.style.transition = 'opacity 900ms 500ms ease-out';
          area.style.opacity = '1';
        }
      }, { threshold: 0.3 });
      io.observe(line);
    }

    /* ---- shot marks settle in ------------------------------------------- */
    var shots = C.qsa('[data-shots] > *');
    if (shots.length && !reduced && 'IntersectionObserver' in window) {
      shots.forEach(function (s) { s.style.opacity = '0'; });
      var sio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        sio.disconnect();
        shots.forEach(function (s, i) {
          setTimeout(function () {
            s.style.transition = 'opacity 320ms ease-out';
            s.style.opacity = '';
          }, i * 34);
        });
      }, { threshold: 0.2 });
      sio.observe(C.qs('[data-shots]'));
    }
  });
})(window.CANES);
