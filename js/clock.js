/* ==========================================================================
   CLOCK
   Counts down to puck drop. The target is an ISO 8601 timestamp with an
   explicit offset in the markup, so the arena's local time is authoritative
   and every visitor sees the same countdown regardless of their zone.

   With JS disabled the markup still shows the date and time, so nothing
   essential depends on this file.
   ========================================================================== */
(function (C) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  C.ready(function () {
    C.qsa('[data-countdown]').forEach(function (root) {
      var iso = root.getAttribute('data-countdown');
      var target = Date.parse(iso);
      if (isNaN(target)) return;

      var out = {
        d: C.qs('[data-unit="d"]', root),
        h: C.qs('[data-unit="h"]', root),
        m: C.qs('[data-unit="m"]', root),
        s: C.qs('[data-unit="s"]', root)
      };
      var live = C.qs('[data-countdown-live]', root);
      var lastAnnounce = 0;

      function render() {
        var diff = target - Date.now();
        if (diff <= 0) {
          root.setAttribute('data-elapsed', 'true');
          if (out.d) out.d.textContent = '00';
          if (out.h) out.h.textContent = '00';
          if (out.m) out.m.textContent = '00';
          if (out.s) out.s.textContent = '00';
          if (live) live.textContent = 'Puck drop.';
          clearInterval(timer);
          return;
        }
        var s = Math.floor(diff / 1000);
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = s % 60;

        if (out.d) out.d.textContent = pad(d);
        if (out.h) out.h.textContent = pad(h);
        if (out.m) out.m.textContent = pad(m);
        if (out.s) out.s.textContent = pad(sec);

        /* Screen readers get one calm update per hour rather than a
           per-second stream from an aria-live region. */
        if (live && Date.now() - lastAnnounce > 3600000) {
          lastAnnounce = Date.now();
          live.textContent = d + ' days, ' + h + ' hours until puck drop.';
        }
      }

      render();
      var timer = setInterval(render, 1000);
    });
  });
})(window.CANES);
