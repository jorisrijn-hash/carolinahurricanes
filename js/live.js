/* ==========================================================================
   LIVE
   Gameday behaviour: the site wide score bar, goal alerts and the offline
   ticket wallet.

   Honest scope. The polling below reads a local JSON file. In production it
   reads the club's game feed, and push alerts need a real push service plus
   VAPID keys on a server. What is real here is the client contract: the
   permission flow, the state machine, the offline shell and the markup the
   feed writes into.
   ========================================================================== */
(function (C) {
  'use strict';

  var POLL_MS = 20000;

  C.ready(function () {
    /* ---- 1. Service worker: offline shell and ticket wallet ------------ */
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* Registration fails on file:// and in private modes. Not fatal:
           every page still works, it just will not work offline. */
      });
    }

    /* ---- 2. Site wide live bar ----------------------------------------
       Appears on every page while a game is in progress so a fan never has
       to navigate to find the score. Dismissible, and the dismissal lasts
       for the session only. */
    var bar = C.qs('[data-livebar]');
    if (bar) {
      var dismissed = false;
      try { dismissed = sessionStorage.getItem('canes:livebar') === 'off'; } catch (err) {}

      var render = function (game) {
        if (!game || game.state !== 'live' || dismissed) {
          bar.hidden = true;
          document.documentElement.classList.remove('has-livebar');
          return;
        }
        bar.hidden = false;
        document.documentElement.classList.add('has-livebar');
        var set = function (sel, value) {
          var el = C.qs(sel, bar);
          if (el && el.textContent !== String(value)) el.textContent = value;
        };
        set('[data-lb-away-score]', game.away.score);
        set('[data-lb-home-score]', game.home.score);
        set('[data-lb-away]', game.away.abbrev);
        set('[data-lb-home]', game.home.abbrev);
        set('[data-lb-clock]', ['1st', '2nd', '3rd', 'OT'][game.period - 1] + ' ' + game.clock);
      };

      C.on(C.qs('[data-livebar-close]', bar), 'click', function () {
        dismissed = true;
        try { sessionStorage.setItem('canes:livebar', 'off'); } catch (err) {}
        render(null);
      });

      /* ---- 3. Goal alerts --------------------------------------------
         Score is announced once per change through a polite live region.
         A notification only fires if the visitor asked for one. */
      var lastHome = null, lastAway = null;
      var announce = C.qs('[data-live-announce]');

      var onGame = function (game) {
        render(game);
        if (!game || game.state !== 'live') return;
        var h = game.home.score, a = game.away.score;
        if (lastHome !== null && (h !== lastHome || a !== lastAway)) {
          var scored = h > lastHome ? game.home.abbrev : game.away.abbrev;
          var line = scored + ' score. ' + game.home.abbrev + ' ' + h +
                     ', ' + game.away.abbrev + ' ' + a + '.';
          if (announce) announce.textContent = line;
          if (scored === game.home.abbrev) document.dispatchEvent(new CustomEvent('canes:goal'));
          if (window.Notification && Notification.permission === 'granted') {
            try {
              new Notification('Goal: ' + scored, {
                body: game.home.abbrev + ' ' + h + ' ' + game.away.abbrev + ' ' + a,
                tag: 'canes-goal',
                icon: 'assets/icons/android-chrome-192x192.png'
              });
            } catch (err) { /* some browsers require a service worker registration */ }
          }
        }
        lastHome = h; lastAway = a;
      };

      var poll = function () {
        if (document.hidden) return;
        fetch('data/game.json', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(onGame)
          .catch(function () { /* offline: keep the last known score on screen */ });
      };
      poll();
      setInterval(poll, POLL_MS);
      C.on(document, 'visibilitychange', function () { if (!document.hidden) poll(); });
    }

    /* ---- 4. Alert opt in ----------------------------------------------
       Never prompt on load. The browser prompt is spent once, so it is only
       requested after a deliberate click. */
    C.qsa('[data-alerts]').forEach(function (btn) {
      var label = C.qs('[data-alerts-state]', btn) || btn;

      var paint = function () {
        if (!('Notification' in window)) {
          label.textContent = 'Not supported on this browser';
          btn.disabled = true;
          return;
        }
        if (Notification.permission === 'granted') {
          label.textContent = 'Goal alerts are on';
          btn.setAttribute('aria-pressed', 'true');
        } else if (Notification.permission === 'denied') {
          label.textContent = 'Blocked in browser settings';
          btn.setAttribute('aria-pressed', 'false');
        } else {
          label.textContent = 'Turn on goal alerts';
          btn.setAttribute('aria-pressed', 'false');
        }
      };

      C.on(btn, 'click', function () {
        if (!('Notification' in window) || Notification.permission !== 'default') return;
        Notification.requestPermission().then(paint);
      });
      paint();
    });

    /* ---- 5. Saved games ------------------------------------------------ */
    C.qsa('[data-save-game]').forEach(function (btn) {
      var id = btn.getAttribute('data-save-game');
      var paint = function () {
        var on = C.prefs && C.prefs.has('saved', id);
        btn.setAttribute('aria-pressed', String(!!on));
        var t = C.qs('[data-save-label]', btn);
        if (t) t.textContent = on ? 'Saved to my games' : 'Save to my games';
      };
      C.on(btn, 'click', function () {
        if (C.prefs) C.prefs.toggleList('saved', id);
        paint();
      });
      paint();
    });
  });
})(window.CANES);
