/* ==========================================================================
   SCHEDULE - home and away filter
   Rows are hidden with a class rather than the hidden attribute because a
   table row set to display:none by [hidden] fights the table layout in
   older engines.
   ========================================================================== */
(function (C) {
  'use strict';
  C.ready(function () {
    var bar = C.qs('[data-sched-filter]');
    var body = C.qs('[data-sched-rows]');
    if (!bar || !body) return;

    var rows = C.qsa('tr[data-venue]', body);
    var count = C.qs('[data-sched-count]');
    var buttons = C.qsa('button', bar);

    function apply(venue) {
      var shown = 0;
      rows.forEach(function (row) {
        var match = venue === 'all' || row.getAttribute('data-venue') === venue;
        row.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-venue') === venue));
      });
      if (count) count.textContent = shown + (shown === 1 ? ' game' : ' games');
    }

    buttons.forEach(function (b) {
      C.on(b, 'click', function () { apply(b.getAttribute('data-venue')); });
    });
  });
})(window.CANES);
