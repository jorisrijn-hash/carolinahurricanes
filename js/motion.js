/* ==========================================================================
   MOTION
   Every effect here is opt-in through a data attribute, checks
   prefers-reduced-motion, and unhooks itself when it is off screen.
   ========================================================================== */
(function (C) {
  'use strict';

  C.ready(function () {
    /* An explicit choice in settings beats the OS setting, in both
       directions: someone who wants motion on a reduced-motion machine can
       have it, and vice versa. */
    function motionOff() {
      var pref = document.documentElement.getAttribute('data-motion');
      if (pref === 'reduced') return true;
      if (pref === 'full') return false;
      return C.prefersReduced();
    }
    var reduced = motionOff() || document.documentElement.classList.contains('data-saver');

    /* ---- 1. Scroll reveals ----------------------------------------------
       Elements start hidden in CSS. If IntersectionObserver is missing or
       motion is reduced, everything is revealed immediately.             */
    /* Wipe headings need an inner block to translate. Building it here
       rather than in the markup keeps every page's HTML clean and means
       the heading still renders normally when JS is unavailable. */
    C.qsa('[data-reveal="wipe"]').forEach(function (el) {
      var inner = document.createElement('span');
      inner.className = 'wipe-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    });

    var targets = C.qsa('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduced) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          /* Reveal when in view, and also when the element is already above
             the viewport. A jump scroll, a deep link or a restored scroll
             position can move past a target without it ever intersecting,
             which would otherwise strand it invisible forever. */
          var passed = entry.boundingClientRect.bottom < 0;
          if (!entry.isIntersecting && !passed) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);   // one shot: no re-animation on scroll back
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      targets.forEach(function (el) { io.observe(el); });
    }

    /* Stagger index: set --i per group so children cascade without hand
       written delays in the markup. */
    C.qsa('[data-stagger]').forEach(function (group) {
      C.qsa('[data-reveal]', group).forEach(function (el, i) {
        el.style.setProperty('--i', Math.min(i, 8));
      });
    });

    /* ---- 2. Instrument rail: scroll gauge + section coordinate ---------- */
    var rail = C.qs('[data-rail]');
    if (rail) {
      var gauge = C.qs('.rail__gauge', rail);
      var coord = C.qs('[data-rail-coord]', rail);
      var marks = C.qsa('[data-coord]');

      var pending = false;
      C.on(window, 'scroll', function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          var h = document.documentElement.scrollHeight - window.innerHeight;
          var p = h > 0 ? C.clamp(window.scrollY / h, 0, 1) : 0;
          if (gauge) gauge.style.setProperty('--scroll', (p * 100).toFixed(2) + '%');

          if (coord && marks.length) {
            var mid = window.scrollY + window.innerHeight * 0.4;
            var active = marks[0];
            for (var i = 0; i < marks.length; i++) {
              if (marks[i].offsetTop <= mid) active = marks[i];
            }
            var next = active.getAttribute('data-coord');
            if (coord.textContent !== next) coord.textContent = next;
          }
          pending = false;
        });
      }, { passive: true });
    }

    /* ---- 3. Parallax ----------------------------------------------------
       Transform only. Never top/left. Depth is set per element with
       data-parallax="0.12" and clamped so nothing detaches from its box. */
    var layers = C.qsa('[data-parallax]');
    if (layers.length && !reduced) {
      var visible = [];
      layers.forEach(function (el) {
        C.whileVisible(el,
          function () { if (visible.indexOf(el) < 0) visible.push(el); },
          function () { var i = visible.indexOf(el); if (i > -1) visible.splice(i, 1); });
        el.style.willChange = 'transform';
      });
      C.loop(function () {
        if (!visible.length) return;
        var vh = window.innerHeight;
        visible.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var centre = r.top + r.height / 2;
          var offset = (centre - vh / 2) / vh;               // -1 .. 1
          var depth = parseFloat(el.getAttribute('data-parallax')) || 0.1;
          el.style.transform = 'translate3d(0,' + (-offset * depth * 100).toFixed(2) + 'px,0)';
        });
      });
    }

    /* ---- 4. Magnetic buttons -------------------------------------------
       Fine pointers only. The pull is capped at 8px: enough to feel
       weighted, not enough to make the target hard to hit.              */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
      C.qsa('[data-magnetic]').forEach(function (el) {
        var raf = null, tx = 0, ty = 0;
        C.on(el, 'pointermove', function (e) {
          var r = el.getBoundingClientRect();
          tx = C.clamp((e.clientX - (r.left + r.width / 2)) * 0.3, -8, 8);
          ty = C.clamp((e.clientY - (r.top + r.height / 2)) * 0.4, -6, 6);
          if (!raf) raf = requestAnimationFrame(function () {
            el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
            raf = null;
          });
        });
        C.on(el, 'pointerleave', function () { el.style.transform = ''; });
      });
    }

    /* ---- 5. Rail navigation --------------------------------------------
       The rail used to be decoration taking 62px of horizontal space. It now
       lists the sections of the current page, marks the one in view, and
       scrolls to them. Built from [data-coord] so no page maintains a
       duplicate list of its own sections. */
    var railDots = C.qs('[data-rail-dots]');
    var marks = C.qsa('[data-coord]');
    if (railDots && marks.length > 1) {
      marks.forEach(function (section, i) {
        var label = section.getAttribute('data-coord');
        var id = section.id || ('sec-' + i);
        section.id = id;
        var li = document.createElement('li');
        li.innerHTML = '<a class="rail__dot" href="#' + id + '">' +
                       '<span class="rail__dot-label">' + label + '</span></a>';
        railDots.appendChild(li);
      });
    }

    /* ---- 6. Counters ----------------------------------------------------
       Numbers count up once when they enter view. The final value lives in
       the markup, so the correct figure is present with JS disabled.    */
    var counters = C.qsa('[data-count]');
    if (counters.length && !reduced && 'IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          cio.unobserve(el);
          var end = parseFloat(el.getAttribute('data-count'));
          var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
          var t0 = performance.now(), dur = 1100;
          var stop = C.loop(function (t) {
            var p = C.clamp((t - t0) / dur, 0, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (end * eased).toFixed(dec);
            if (p === 1) stop();
          });
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    }

    /* ---- 7. Marquee: duplicate the track so the loop is seamless -------- */
    C.qsa('[data-marquee]').forEach(function (track) {
      track.innerHTML += track.innerHTML;
    });

    /* ---- 8. Scale bars: fill on reveal ---------------------------------- */
    C.qsa('.scale').forEach(function (scale) {
      C.qsa('.scale__fill', scale).forEach(function (fill, i) { fill.style.setProperty('--i', i); });
    });
  });
})(window.CANES);
