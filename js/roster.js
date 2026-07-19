/* ==========================================================================
   ROSTER - position filter
   Progressive enhancement: with JS unavailable every player is rendered and
   visible. The filter only ever hides, never fetches.
   ========================================================================== */
(function (C) {
  'use strict';
  C.ready(function () {
    var bar = C.qs('[data-roster-filter]');
    var grid = C.qs('[data-roster-grid]');
    if (!bar || !grid) return;

    var cards = C.qsa('[data-pos]', grid);
    var count = C.qs('[data-roster-count]');
    var empty = C.qs('[data-roster-empty]');
    var buttons = C.qsa('button', bar);

    function apply(pos) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = pos === 'all' || card.getAttribute('data-pos') === pos;
        card.hidden = !match;
        if (match) shown++;
      });
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-pos') === pos));
      });
      if (count) count.textContent = shown + (shown === 1 ? ' player' : ' players');
      if (empty) empty.hidden = shown !== 0;
    }

    buttons.forEach(function (b) {
      C.on(b, 'click', function () { apply(b.getAttribute('data-pos')); });
    });
  });
})(window.CANES);
