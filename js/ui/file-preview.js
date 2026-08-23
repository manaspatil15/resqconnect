/* ==========================================================================
   ResQConnect — file-preview.js
   window.initFilePreview({ input, previewContainer, maxSizeMB, accept })

   Wires a <input type="file"> to a live image preview. Frontend-only —
   nothing is uploaded anywhere; this just reads the file locally via
   URL.createObjectURL() for the preview. Validates type and size and
   reports errors through showToast().

   Usage:
     initFilePreview({
       input: document.getElementById('mpPhoto'),
       previewContainer: document.getElementById('mpPhotoPreview')
     });

   Returns { getFile, clear } so the calling form can read the selected
   File object at submit time and reset the picker afterward.
   ========================================================================== */

(function () {
  "use strict";

  const DEFAULT_ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const DEFAULT_MAX_MB = 5;

  function initFilePreview(opts) {
    const { input, previewContainer, maxSizeMB = DEFAULT_MAX_MB, accept = DEFAULT_ACCEPT } = opts || {};
    if (!input || !previewContainer) return null;

    let currentFile = null;
    let currentUrl = null;

    function clear() {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = null;
      currentFile = null;
      input.value = "";
      previewContainer.innerHTML = "";
      previewContainer.hidden = true;
    }

    function render(file) {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(file);
      currentFile = file;

      previewContainer.hidden = false;
      previewContainer.innerHTML = `
        <div class="file-preview">
          <img src="${currentUrl}" alt="Selected photo preview" />
          <button type="button" class="btn btn-outline btn-sm" data-remove-photo>Remove photo</button>
        </div>`;

      previewContainer.querySelector("[data-remove-photo]").addEventListener("click", clear);
    }

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (!accept.includes(file.type)) {
        if (window.showToast) showToast({ type: "error", message: "Please choose a JPG, PNG, or WEBP image." });
        input.value = "";
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        if (window.showToast) showToast({ type: "error", message: `Image is too large — please choose a file under ${maxSizeMB}MB.` });
        input.value = "";
        return;
      }

      render(file);
    });

    return {
      getFile: () => currentFile,
      clear
    };
  }

  window.initFilePreview = initFilePreview;
})();
