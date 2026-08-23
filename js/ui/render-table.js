/* ==========================================================================
   ResQConnect — render-table.js
   window.renderCollection({ container, items, rowTemplate, emptyState })

   Renders `items` into `container.innerHTML` using `rowTemplate(item)`
   (a function returning an HTML string per row). If `items` is empty,
   renders the empty state instead (via buildEmptyState — see
   ui/empty-state.js) so every table/list gets consistent empty handling
   without each page writing its own if/else.

   Usage (table body):
     renderCollection({
       container: document.querySelector("#usersTable tbody"),
       items: ResQStore.getAll("users"),
       rowTemplate: (u) => `<tr><td>${u.name}</td>...</tr>`,
       emptyState: { title: "No users found", description: "Try a different search." }
     });
   ========================================================================== */

(function () {
  "use strict";

  function renderCollection(opts) {
    const { container, items = [], rowTemplate, emptyState } = opts || {};
    if (!container || typeof rowTemplate !== "function") {
      console.error("renderCollection: container and rowTemplate are required.");
      return;
    }

    if (!items.length) {
      const emptyHtml = window.buildEmptyState
        ? window.buildEmptyState(emptyState || {})
        : "<p>No results.</p>";

      if (container.tagName === "TBODY") {
        container.innerHTML = `<tr><td colspan="100%" class="empty-state-cell" style="padding:0;border:none;">${emptyHtml}</td></tr>`;
      } else {
        container.innerHTML = emptyHtml;
      }
      return;
    }

    container.innerHTML = items.map(rowTemplate).join("");
  }

  window.renderCollection = renderCollection;
})();
