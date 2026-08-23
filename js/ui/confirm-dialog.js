/* ==========================================================================
   ResQConnect — confirm-dialog.js
   window.confirmAction({ title, body, confirmLabel, cancelLabel, danger })
     -> Promise<boolean>

   Reuses the existing .modal-overlay / .modal markup + CSS (main.js
   already handles Escape-to-close and overlay-click-to-close for any
   .modal-overlay, so this dialog gets that for free).

   Usage:
     const ok = await confirmAction({
       title: "Delete Alert?",
       body: "This action cannot be undone.",
       confirmLabel: "Delete",
       danger: true
     });
     if (ok) { ... }
   ========================================================================== */

(function () {
  "use strict";

  function getOverlay() {
    let overlay = document.getElementById("rqcConfirmModal");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "rqcConfirmModal";
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head">' +
          '<h3 id="rqcConfirmTitle">Are you sure?</h3>' +
          '<button class="modal-close" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<p id="rqcConfirmBody"></p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-outline" type="button" data-role="cancel">Cancel</button>' +
          '<button class="btn btn-primary" type="button" data-role="confirm">Confirm</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // main.js's initModals() only wires up .modal-overlay elements that
    // existed at DOMContentLoaded, so wire this dynamically-created one
    // itself: click outside + the built-in close button.
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector(".modal-close").addEventListener("click", () => close(false));

    return overlay;
  }

  let activeResolve = null;
  function close(result) {
    const overlay = document.getElementById("rqcConfirmModal");
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    if (activeResolve) {
      const resolve = activeResolve;
      activeResolve = null;
      resolve(result);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const overlay = document.getElementById("rqcConfirmModal");
      if (overlay && overlay.classList.contains("open")) close(false);
    }
  });

  function confirmAction(opts) {
    const {
      title = "Are you sure?",
      body = "",
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      danger = false
    } = opts || {};

    return new Promise((resolve) => {
      const overlay = getOverlay();
      overlay.classList.toggle("modal-danger", !!danger);
      overlay.querySelector("#rqcConfirmTitle").textContent = title;
      overlay.querySelector("#rqcConfirmBody").textContent = body;

      const cancelBtn = overlay.querySelector('[data-role="cancel"]');
      const confirmBtn = overlay.querySelector('[data-role="confirm"]');
      cancelBtn.textContent = cancelLabel;
      confirmBtn.textContent = confirmLabel;
      confirmBtn.className = "btn " + (danger ? "btn-emergency" : "btn-primary");

      // Replace nodes to drop any previously-bound listeners from a prior call.
      const newCancel = cancelBtn.cloneNode(true);
      const newConfirm = confirmBtn.cloneNode(true);
      cancelBtn.replaceWith(newCancel);
      confirmBtn.replaceWith(newConfirm);
      newCancel.addEventListener("click", () => close(false));
      newConfirm.addEventListener("click", () => close(true));

      activeResolve = resolve;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      newConfirm.focus();
    });
  }

  window.confirmAction = confirmAction;
})();
