/* ==========================================================================
   DEV ONLY - placeholder tagging
   Labels every generated plate in the interface so no unlicensed artwork
   can reach production mistaken for a real photograph.

   Remove this script tag when the licensed assets are dropped in, or add
   class="assets-final" to <html> to hide the tags without removing them.
   ========================================================================== */
(function (C) {
  'use strict';
  C.ready(function () {
    C.qsa('[data-spec]').forEach(function (el) {
      if (C.qs('.plate__tag', el)) return;
      var tag = document.createElement('span');
      tag.className = 'plate__tag';
      tag.setAttribute('aria-hidden', 'true');
      tag.textContent = 'PLACEHOLDER / ' + el.getAttribute('data-spec');
      el.appendChild(tag);
    });
  });
})(window.CANES);
