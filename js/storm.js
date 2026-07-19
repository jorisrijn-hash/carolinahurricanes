/* ==========================================================================
   STORM
   Two canvases, both parked when off screen or when the tab is hidden.

   1. Radar console - Lenovo Center at the origin, the next opponent
      plotted at its true bearing and range from Raleigh, a track line and
      a cone of uncertainty running in. The sweep is the only thing that
      moves quickly.
   2. Atmosphere - a thin field of drifting ice particles behind the hero.
      Count scales with viewport area and is capped hard.
   ========================================================================== */
(function (C) {
  'use strict';

  var RAL = { lat: 35.8033, lon: -78.7217 };   // Lenovo Center

  /* Great-circle bearing and distance, so the blip sits where the opponent
     actually is rather than somewhere decorative. */
  function vector(from, to) {
    var toRad = Math.PI / 180;
    var dLon = (to.lon - from.lon) * toRad;
    var lat1 = from.lat * toRad, lat2 = to.lat * toRad;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    var bearing = Math.atan2(y, x);                       // 0 = north, clockwise
    var dLat = lat2 - lat1;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { bearing: bearing, km: km };
  }

  C.ready(function () {
    /* Data saver stops both canvases outright. On congested arena wifi a
       decorative particle field is the first thing that should go. */
    var saver = document.documentElement.classList.contains('data-saver');

    /* ================= RADAR ============================================ */
    var canvas = C.qs('[data-radar]');
    if (canvas && !saver) {
      var ctx = canvas.getContext('2d');
      var target = {
        lat: parseFloat(canvas.getAttribute('data-lat')),
        lon: parseFloat(canvas.getAttribute('data-lon')),
        code: canvas.getAttribute('data-code') || ''
      };
      var v = (isFinite(target.lat) && isFinite(target.lon))
        ? vector(RAL, target)
        : { bearing: -0.9, km: 900 };
      var maxKm = 1400;                       // scope range
      var stop = null, t0 = performance.now();

      function draw(t) {
        var m = C.fitCanvas(canvas), w = m.w, h = m.h, d = m.dpr;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, w, h);

        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;
        var e = (t - t0) / 1000;
        var reduced = C.prefersReduced();

        // ---- range rings + labels
        ctx.lineWidth = 1;
        for (var i = 1; i <= 4; i++) {
          ctx.strokeStyle = i === 4 ? 'rgba(58,65,73,1)' : 'rgba(43,48,55,.9)';
          ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2); ctx.stroke();
        }

        // ---- graticule
        ctx.strokeStyle = 'rgba(43,48,55,.75)';
        ctx.beginPath();
        for (var a = 0; a < 12; a++) {
          var ang = a * Math.PI / 6;
          ctx.moveTo(cx + Math.cos(ang) * R * 0.12, cy + Math.sin(ang) * R * 0.12);
          ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        }
        ctx.stroke();

        // ---- sweep
        if (!reduced) {
          var sweep = e * 1.15;
          if (ctx.createConicGradient) {
            var g = ctx.createConicGradient(sweep, cx, cy);
            g.addColorStop(0.00, 'rgba(255,34,51,.30)');
            g.addColorStop(0.06, 'rgba(204,0,0,.10)');
            g.addColorStop(0.26, 'rgba(204,0,0,0)');
            g.addColorStop(1.00, 'rgba(204,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = 'rgba(255,34,51,.85)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();
        }

        // ---- target: screen bearing is compass bearing rotated so north is up
        var scr = v.bearing - Math.PI / 2;
        var dist = Math.min(v.km / maxKm, 0.94) * R;
        var tx = cx + Math.cos(scr) * dist, ty = cy + Math.sin(scr) * dist;

        // cone of uncertainty running from the target to the origin
        var spread = 0.16;
        ctx.fillStyle = 'rgba(204,0,0,.10)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(scr - spread) * dist * 1.12, cy + Math.sin(scr - spread) * dist * 1.12);
        ctx.lineTo(cx + Math.cos(scr + spread) * dist * 1.12, cy + Math.sin(scr + spread) * dist * 1.12);
        ctx.closePath(); ctx.fill();

        // track line, dashed, running inbound
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = reduced ? 0 : -e * 26;
        ctx.strokeStyle = 'rgba(233,231,228,.42)';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.setLineDash([]);

        // target blip
        var pulse = reduced ? 0.6 : 0.5 + Math.sin(e * 3.1) * 0.35;
        ctx.fillStyle = 'rgba(255,34,51,' + (0.25 * pulse).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF2233';
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();

        ctx.font = '600 10px "Martian Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(233,231,228,.9)';
        ctx.textAlign = tx > cx ? 'right' : 'left';
        ctx.fillText(target.code, tx + (tx > cx ? -12 : 12), ty - 10);

        // origin: Lenovo Center
        ctx.strokeStyle = '#E9E7E4'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.stroke();

        // cardinal marks
        ctx.font = '400 9px "Martian Mono", ui-monospace, monospace';
        ctx.fillStyle = 'rgba(138,145,152,.9)';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - R - 6);
        ctx.fillText('S', cx, cy + R + 14);
        ctx.textAlign = 'left';  ctx.fillText('E', cx + R + 6, cy + 3);
        ctx.textAlign = 'right'; ctx.fillText('W', cx - R - 6, cy + 3);
      }

      C.whileVisible(canvas,
        function () { if (!stop) stop = C.loop(draw); },
        function () { if (stop) { stop(); stop = null; } });
      draw(performance.now());
    }

    /* ================= ATMOSPHERE ======================================= */
    var atmos = C.qs('[data-atmos]');
    if (atmos && !saver && !C.prefersReduced()) {
      var actx = atmos.getContext('2d');
      var parts = [], stopA = null, sized = 0;

      function seed(w, h) {
        // Density scales with area, capped so a 4K monitor stays cheap.
        var n = Math.min(90, Math.round((w * h) / 26000));
        parts = [];
        for (var i = 0; i < n; i++) {
          parts.push({
            x: Math.random() * w, y: Math.random() * h,
            r: Math.random() * 1.5 + 0.35,
            vx: (Math.random() * 0.5 + 0.16) * (Math.random() < 0.5 ? -1 : 1),
            vy: Math.random() * 0.24 + 0.06,
            a: Math.random() * 0.35 + 0.08
          });
        }
        sized = w * h;
      }

      function drawA() {
        var m = C.fitCanvas(atmos), w = m.w, h = m.h, d = m.dpr;
        if (!parts.length || Math.abs(sized - w * h) > 40000) seed(w, h);
        actx.setTransform(d, 0, 0, d, 0, 0);
        actx.clearRect(0, 0, w, h);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.x += p.vx; p.y += p.vy;
          if (p.y > h + 4) { p.y = -4; p.x = Math.random() * w; }
          if (p.x < -4) p.x = w + 4; else if (p.x > w + 4) p.x = -4;
          actx.fillStyle = 'rgba(233,231,228,' + p.a.toFixed(3) + ')';
          actx.beginPath(); actx.arc(p.x, p.y, p.r, 0, Math.PI * 2); actx.fill();
        }
      }

      C.whileVisible(atmos,
        function () { if (!stopA) stopA = C.loop(drawA); },
        function () { if (stopA) { stopA(); stopA = null; } });
    }
  });
})(window.CANES);
