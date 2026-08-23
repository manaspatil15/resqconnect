/* ==========================================================================
   ResQConnect — demo-form.js
   window.handleDemoSubmit(form, { onValid, loadingText })

   Shared plumbing for the several public forms that simulate a submit
   with no backend yet (login, register, volunteer registration, donate,
   contact). Each page still owns its own "what happens on success"
   logic (onValid) — this just avoids re-writing the same
   validate -> loading-state -> settle sequence five times.

   Does NOT replace main.js's initFormValidation — that still runs first
   and adds/removes .field.error classes. This only proceeds with the
   loading simulation if the form is natively valid.
   ========================================================================== */

(function () {
  "use strict";

  function handleDemoSubmit(form, opts) {
    const { onValid, loadingText = "Submitting…" } = opts || {};
    if (!form || typeof onValid !== "function") return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) return; // main.js's handler already flagged the invalid fields

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = loadingText;
      }

      // Short simulated delay so the loading state is visible without
      // making the prototype feel slow.
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
        onValid();
      }, 700);
    });
  }

  window.handleDemoSubmit = handleDemoSubmit;
})();
