/* ==========================================================================
   TICKETS
   All-in pricing, tier selection with seat views, sorting, and the
   membership calculator.

   Every price on the page is derived from one embedded object, so the cards,
   the tier panel and the calculator cannot disagree.
   ========================================================================== */
(function (C) {
  'use strict';

  function money(n) {
    // A price that cannot be computed must not render as "$NaN".
    if (typeof n !== 'number' || !isFinite(n)) return '--';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  C.ready(function () {
    if (!C.qs('[data-game-grid]')) return;

    var base = document.documentElement.getAttribute('data-basepath') || '';
    fetch(base + 'data/tickets.json')
      .then(function (r) { return r.json(); })
      .then(start)
      .catch(function () {
        /* Pricing is already rendered in the markup at build time, so a
           failed fetch costs the fee toggle and the calculator, not the
           prices themselves. */
        var bar = C.qs('.pricebar');
        if (bar) bar.hidden = true;
      });
  });

  function start(data) {
    var C = window.CANES;
    var tiers = {};
    data.tiers.forEach(function (t) { tiers[t.key] = t; });

    /* All-in is the true price: base plus percentage fee plus flat fee. */
    function allIn(base) { return base * (1 + data.feeRate) + data.feeFlat; }

    var grid = C.qs('[data-game-grid]');

    /* ---- 1. All-in toggle ---------------------------------------------- */
    var toggle = C.qs('[data-allin]');
    var note = C.qs('[data-allin-note]');
    /* Scoped to the grid on purpose. An unscoped attribute selector once
       matched <html data-base>, wrote "$NaN" into documentElement.textContent
       and deleted the entire page. Query inside the component you own. */
    var prices = grid ? C.qsa('[data-price-base]', grid) : [];

    function paintPrices() {
      var on = !toggle || toggle.checked;
      prices.forEach(function (el) {
        var base = parseFloat(el.getAttribute('data-price-base'));
        el.textContent = money(on ? allIn(base) : base);
      });
      if (note) {
        note.textContent = on
          ? 'Showing final price including fees and taxes.'
          : 'Showing base price. Fees are added at checkout.';
      }
      paintTier(currentTier);
    }

    if (toggle) C.on(toggle, 'change', paintPrices);

    /* ---- 2. Sorting ------------------------------------------------------ */
    C.qsa('[data-sort]').forEach(function (btn) {
      C.on(btn, 'click', function () {
        var mode = btn.getAttribute('data-sort');
        C.qsa('[data-sort]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        if (!grid) return;
        var cards = C.qsa('.gcard', grid);
        if (mode === 'price') {
          cards.sort(function (a, b) {
            return parseFloat(a.getAttribute('data-price')) - parseFloat(b.getAttribute('data-price'));
          });
        } else {
          // Date order is the order the build emitted them.
          cards.sort(function (a, b) {
            return cards.indexOf(a) - cards.indexOf(b);
          });
          cards = C.qsa('.gcard', grid);
        }
        cards.forEach(function (c) { grid.appendChild(c); });
      });
    });

    /* ---- 3. Tier selection + seat view ---------------------------------- */
    var shapes = C.qsa('.tier');
    var buttons = C.qsa('[data-tier-buttons] button');
    var elTier = C.qs('[data-price-tier]');
    var elVal = C.qs('[data-price-val]');
    var elRows = C.qs('[data-price-rows]');
    var elNote = C.qs('[data-price-note]');
    var elImg = C.qs('[data-seat-img]');
    var elCap = C.qs('[data-seat-cap]');
    var currentTier = 'glass';

    function paintTier(key) {
      var tier = tiers[key];
      if (!tier) return;
      currentTier = key;
      var on = !toggle || toggle.checked;
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-tier') === key));
      });
      shapes.forEach(function (s) {
        s.classList.toggle('is-active', s.getAttribute('data-tier') === key);
      });
      if (elTier) elTier.textContent = tier.label;
      if (elVal) elVal.textContent = money(on ? allIn(tier.from) : tier.from);
      if (elRows) elRows.textContent = tier.rows;
      if (elNote) elNote.textContent = tier.note;
      if (elImg) {
        elImg.src = 'assets/img/' + tier.view + '.jpg';
        elImg.alt = 'View of the ice from the ' + tier.label.toLowerCase() + ' tier';
      }
      if (elCap) elCap.textContent = 'Sightline from the ' + tier.label.toLowerCase();
    }

    buttons.forEach(function (b) {
      C.on(b, 'click', function () { paintTier(b.getAttribute('data-tier')); });
    });

    /* ---- 4. Membership calculator ----------------------------------------
       The honest version: it shows the plan losing when the plan loses. A
       calculator that always recommends the upsell is not a calculator. */
    var input = C.qs('[data-calc-input]');
    if (input) {
      var outGames = C.qs('[data-calc-games]');
      var outSingle = C.qs('[data-calc-single]');
      var outPlan = C.qs('[data-calc-plan]');
      var outPlanLabel = C.qs('[data-calc-plan-label]');
      var outSave = C.qs('[data-calc-save]');
      var verdict = C.qs('[data-calc-verdict]');

      var avgSingle = 0;
      C.qsa('.gcard').forEach(function (c) { avgSingle += parseFloat(c.getAttribute('data-price')); });
      avgSingle = avgSingle / Math.max(1, C.qsa('.gcard').length);

      function recalc() {
        var n = parseInt(input.value, 10);
        var singleTotal = allIn(avgSingle) * n;

        // Cheapest plan that actually covers the games they want.
        var best = null;
        data.plans.forEach(function (p) {
          if (p.games < n) return;
          var cost = allIn(p.perGame) * p.games;
          if (!best || cost < best.cost) best = { plan: p, cost: cost };
        });

        if (outGames) outGames.textContent = n;
        if (outSingle) outSingle.textContent = money(singleTotal);

        if (!best) {
          if (outPlanLabel) outPlanLabel.textContent = 'No plan covers that many';
          if (outPlan) outPlan.textContent = '--';
          if (outSave) outSave.textContent = money(0);
          if (verdict) verdict.innerHTML = '<p class="mono">Talk to the membership team about a custom package.</p>';
          return;
        }

        var saving = singleTotal - best.cost;
        if (outPlanLabel) {
          outPlanLabel.textContent = best.plan.label + ', ' + best.plan.games + ' games';
        }
        if (outPlan) outPlan.textContent = money(best.cost);
        if (outSave) outSave.textContent = money(Math.max(0, saving));

        if (verdict) {
          verdict.innerHTML = saving > 0
            ? '<p class="mono mono--bone">At ' + n + ' games the ' + best.plan.label.toLowerCase() +
              ' costs ' + money(Math.abs(saving)) + ' less than buying singles, and you keep the same seat.</p>'
            : '<p class="mono">At ' + n + ' games singles are the cheaper option. Come back when you are going more often.</p>';
        }
      }

      C.on(input, 'input', recalc);
      recalc();
    }

    paintPrices();
    paintTier('glass');
  }
})(window.CANES);
