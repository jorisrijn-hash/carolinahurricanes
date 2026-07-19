/* ==========================================================================
   CORE - namespace + shared utilities
   Classic scripts, not ES modules, so the build runs from file:// as well
   as from a server. Each file attaches to window.CANES and does nothing
   until DOM ready.
   ========================================================================== */
window.CANES = (function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function on(el, type, fn, opts) {
    if (!el) return function () {};
    el.addEventListener(type, fn, opts);
    return function () { el.removeEventListener(type, fn, opts); };
  }

  /* One rAF loop for every animated subsystem. Subscribers are skipped when
     the tab is hidden, so nothing burns cycles in a background tab. */
  var tasks = [], running = false;
  function tick(t) {
    running = false;
    for (var i = 0; i < tasks.length; i++) tasks[i](t);
    if (tasks.length && !document.hidden) start();
  }
  function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
  function loop(fn) {
    tasks.push(fn); start();
    return function () { var i = tasks.indexOf(fn); if (i > -1) tasks.splice(i, 1); };
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  /* Size a canvas to its box at the device pixel ratio, capped at 2 so a
     3x phone does not render nine times the pixels for no visible gain. */
  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Run fn only while el is intersecting. Used to park canvases off-screen. */
  function whileVisible(el, on_, off) {
    if (!('IntersectionObserver' in window)) { on_(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? on_() : off();
    }, { rootMargin: '120px' });
    io.observe(el);
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function prefersReduced() { return reduced.matches; }

  function trapFocus(container) {
    var sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    return function (e) {
      if (e.key !== 'Tab') return;
      var items = qsa(sel, container).filter(function (n) { return n.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
  }

  return {
    qs: qs, qsa: qsa, on: on, loop: loop, fitCanvas: fitCanvas,
    clamp: clamp, lerp: lerp, whileVisible: whileVisible,
    ready: ready, prefersReduced: prefersReduced, trapFocus: trapFocus
  };
})();
