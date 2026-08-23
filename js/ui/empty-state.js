/* ==========================================================================
   ResQConnect — empty-state.js
   window.buildEmptyState({ icon, title, description, actionLabel, actionHref })
     -> returns an HTML string, e.g.:

   container.innerHTML = buildEmptyState({
     title: "No active rescue cases",
     description: "There are currently no active cases assigned to your team."
   });
   ========================================================================== */

(function () {
  "use strict";

  const DEFAULT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';

  function buildEmptyState(opts) {
    const {
      icon = DEFAULT_ICON,
      title = "Nothing here yet",
      description = "",
      actionLabel = "",
      actionHref = "#"
    } = opts || {};

    const action = actionLabel
      ? `<a href="${actionHref}" class="btn btn-outline btn-sm">${actionLabel}</a>`
      : "";

    return (
      `<div class="empty-state">` +
        `<div class="empty-state__icon">${icon}</div>` +
        `<h3>${title}</h3>` +
        (description ? `<p>${description}</p>` : "") +
        action +
      `</div>`
    );
  }

  window.buildEmptyState = buildEmptyState;
})();
