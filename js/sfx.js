/* ==========================================================================
   SFX
   Synthesised with the Web Audio API. No audio files, so the feature costs
   zero bytes of payload and never blocks a page.

   Non negotiables:
   - OFF by default. Sound a visitor did not ask for is hostile, and on a
     sports site it is how you get muted at work and never come back.
   - The context is only created after a real gesture, so nothing trips
     autoplay policy.
   - Every sound is under 400ms and peaks well below full scale.
   - Muted when the tab is hidden.
   ========================================================================== */
(function (C) {
  'use strict';

  var ctx = null;
  var master = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.085;         // barely there by design
    master.connect(ctx.destination);
    return ctx;
  }

  function enabled() {
    return C.prefs && C.prefs.get('sfx') === true;
  }

  /* Short filtered noise burst: skate edge, spray, whoosh. */
  function noise(dur, from, to, gain) {
    var frames = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(from, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  function tone(freq, dur, type, gain, slideTo) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  /* Everything here is deliberately understated. These are interface sounds
     that happen to be cold and airy, not sports foley. If a sound is
     noticeable on its own it is too loud. */
  var SOUNDS = {
    /* Click: a soft muted tick, closer to a fingertip than a slapshot. */
    puck: function () {
      tone(320, 0.045, 'sine', 0.16, 190);
      noise(0.028, 3400, 1800, 0.05);
    },
    /* Hover: a breath of air, near the edge of hearing. */
    carve: function () {
      noise(0.10, 6400, 3200, 0.022);
    },
    /* Navigation: low, short, more felt than heard. */
    whoosh: function () {
      noise(0.20, 640, 220, 0.05);
    },
    /* Goal horn. Reserved for an actual goal, never for UI. */
    horn: function () {
      // Still the loudest thing here, and still well under the old level.
      [146.8, 185.0, 220.0].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.7, 'triangle', 0.10); }, i * 45);
      });
    },
    /* Form error: a soft two note fall, not a referee's whistle. */
    whistle: function () {
      tone(660, 0.10, 'sine', 0.05);
      setTimeout(function () { tone(494, 0.14, 'sine', 0.045); }, 90);
    }
  };

  var Sfx = {
    play: function (name) {
      if (!enabled() || document.hidden) return;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      try { (SOUNDS[name] || function () {})(); } catch (err) { /* never break UI for audio */ }
    },
    prime: function () { if (enabled()) ensure(); }
  };

  C.sfx = Sfx;

  C.ready(function () {
    /* Bind to deliberate actions only. Never to scroll, never to load. */
    C.on(document, 'pointerdown', function (ev) {
      if (ev.target.closest('a,button,.chip,.switch')) Sfx.play('puck');
    });
    C.on(document, 'pointerover', function (ev) {
      if (ev.target.closest('.nav__link,.gcard,.player,.card')) Sfx.play('carve');
    });
    C.on(document, 'submit', function () { Sfx.play('whistle'); });

    /* A goal in the live feed is the one thing worth a horn. */
    C.on(document, 'canes:goal', function () { Sfx.play('horn'); });

    // First gesture after enabling primes the context.
    C.on(document, 'pointerdown', Sfx.prime, { once: true });
  });
})(window.CANES);
