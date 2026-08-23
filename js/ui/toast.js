/* ==========================================================================
   ResQConnect — toast.js
   window.showToast({ type, message, duration })

   type: "success" | "error" | "warning" | "info" (default: "info")
   duration: ms before auto-dismiss (default: 4200). Pass 0 to require
             manual dismissal.

   Usage:
     showToast({ type: "success", message: "Alert created successfully" });
   ========================================================================== */

(function () {
  "use strict";

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 9v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 16v-4M12 8h.01"/></svg>'
  };

  function getStack() {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack";
      stack.className = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast(opts) {
    const { type = "info", message = "", duration = 4200 } = opts || {};
    if (!message) return;

    const stack = getStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML =
      `<span class="toast__icon">${ICONS[type] || ICONS.info}</span>` +
      `<div class="toast__body"><p>${message}</p></div>` +
      `<button class="toast__close" aria-label="Dismiss notification">&times;</button>`;

    stack.appendChild(toast);

    let dismissTimer;
    function dismiss() {
      clearTimeout(dismissTimer);
      toast.classList.add("toast-out");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }

    toast.querySelector(".toast__close").addEventListener("click", dismiss);
    if (duration > 0) dismissTimer = setTimeout(dismiss, duration);

    return { dismiss };
  }

  window.showToast = showToast;
})();
