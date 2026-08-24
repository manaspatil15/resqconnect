/* ==========================================================================
   ResQConnect — main.js
   Shared behavior for every page: navigation, theme, popovers, modal,
   validation, and small progressive-enhancement niceties.
   Loaded on every page BEFORE dashboard.js (dashboard.js only runs its own
   code if dashboard-only elements exist on the page).
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. Utilities
     ------------------------------------------------------------------ */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
     1. THEME (dark mode toggle) — persisted across navigation in localStorage
     ------------------------------------------------------------------ */
  const THEME_STORAGE_KEY = "resqconnect_theme";

  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
  }

  function initTheme() {
    const root = document.documentElement;
    const saved = getSavedTheme();
    if (saved === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (saved === "light") {
      root.removeAttribute("data-theme");
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
    }

    const toggle = $("#themeToggle");
    if (!toggle) return;

    const syncIcon = () => {
      const isDark = root.getAttribute("data-theme") === "dark";
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.innerHTML = isDark
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    };

    toggle.addEventListener("click", () => {
      const isDark = root.getAttribute("data-theme") === "dark";
      const next = isDark ? "light" : "dark";
      if (next === "dark") root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      saveTheme(next);
      syncIcon();
    });
    syncIcon();
  }

  /* ------------------------------------------------------------------
     2. MOBILE MENU TOGGLE
     ------------------------------------------------------------------ */
  function initMobileMenu() {
    const btn = $("#menuToggle");
    const nav = $("#navLinks");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    // Close menu when a link is tapped (mobile)
    $$("a", nav).forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }));
  }

  /* ------------------------------------------------------------------
     3. ACTIVE NAV HIGHLIGHTING
        Compares the current filename against each nav link's href.
     ------------------------------------------------------------------ */
  function highlightActiveNav() {
    const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    $$(".nav-links a, .sidebar-nav a").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href === current || (current === "" && href === "index.html")) {
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  /* ------------------------------------------------------------------
     4. GENERIC DROPDOWN / POPOVER (notification bell, user menu)
        Any element with [data-popover-trigger] toggles the sibling
        element referenced by its data-target attribute (an id).
     ------------------------------------------------------------------ */
  function initPopovers() {
    $$("[data-popover-trigger]").forEach((trigger) => {
      const targetId = trigger.getAttribute("data-target");
      const panel = document.getElementById(targetId);
      if (!panel) return;

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !panel.classList.contains("open");
        $$(".popover.open").forEach((p) => p.classList.remove("open"));
        panel.classList.toggle("open", willOpen);
      });
    });

    // Click outside closes all open popovers
    document.addEventListener("click", (e) => {
      $$(".popover.open").forEach((p) => {
        if (!p.contains(e.target)) p.classList.remove("open");
      });
    });

    // Escape closes popovers
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".popover.open").forEach((p) => p.classList.remove("open"));
    });
  }

  /* ------------------------------------------------------------------
     5. MODAL
        Trigger:  <button data-modal-open="modalId">
        Close:    <button data-modal-close> or .modal-overlay itself
     ------------------------------------------------------------------ */
  function initModals() {
    $$("[data-modal-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modal = document.getElementById(btn.getAttribute("data-modal-open"));
        if (modal) {
          modal.classList.add("open");
          document.body.style.overflow = "hidden";
          const focusable = modal.querySelector("input, button, textarea, select");
          if (focusable) focusable.focus();
        }
      });
    });

    $$(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
      $$("[data-modal-close]", overlay).forEach((btn) =>
        btn.addEventListener("click", () => closeModal(overlay))
      );
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".modal-overlay.open").forEach(closeModal);
    });

    function closeModal(overlay) {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  /* ------------------------------------------------------------------
     6. SMOOTH SCROLL for in-page anchor links (e.g. "#how-it-works")
     ------------------------------------------------------------------ */
  function initSmoothScroll() {
    $$('a[href^="#"]:not([href="#"])').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.getElementById(a.getAttribute("href").slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ------------------------------------------------------------------
     7. FORM VALIDATION
        Any <form data-validate> is intercepted on submit. Each field's
        wrapping .field gets an "error" class + shows .error-msg when
        invalid. Rules read from the input's native attributes
        (required, type=email, minlength, pattern) — no extra markup
        needed beyond a .error-msg element per field.
     ------------------------------------------------------------------ */
  function initFormValidation() {
    $$("form[data-validate]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        let valid = true;

        $$(".field", form).forEach((field) => {
          const input = field.querySelector(".input, .select, .textarea");
          if (!input) return;
          const ok = input.checkValidity();
          field.classList.toggle("error", !ok);
          if (!ok) valid = false;
        });

        if (!valid) {
          e.preventDefault();
          const firstError = form.querySelector(".field.error .input, .field.error .select, .field.error .textarea");
          if (firstError) firstError.focus();
          return;
        }

        // No backend wired up in this static prototype — show a success
        // state instead of actually submitting, unless the form opts out.
        if (!form.hasAttribute("data-allow-submit")) {
          e.preventDefault();
          showFormSuccess(form);
        }
      });

      // Live-clear error state as the user fixes a field
      $$(".input, .select, .textarea", form).forEach((input) => {
        input.addEventListener("input", () => {
          const field = input.closest(".field");
          if (field && input.checkValidity()) field.classList.remove("error");
        });
      });
    });
  }

  function showFormSuccess(form) {
    let note = form.querySelector(".form-success");
    if (!note) {
      note = document.createElement("div");
      note.className = "callout callout-info form-success";
      note.style.marginTop = "16px";
      note.innerHTML = "<p><strong>Submitted.</strong> This is a static prototype, so no data was sent — in production this would POST to the ResQConnect API.</p>";
      form.appendChild(note);
    }
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ------------------------------------------------------------------
     8. SCROLL REVEAL — subtle fade/rise for .reveal elements
     ------------------------------------------------------------------ */
  function initScrollReveal() {
    const items = $$(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in-view"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "60px 0px" }
    );

    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 40 && rect.bottom > -40) {
        el.classList.add("in-view");
      } else {
        io.observe(el);
      }
    });
  }

  /* ------------------------------------------------------------------
     9. ALERT RIBBON — the site's signature severity ticker.
        Data now lives in js/mock/mock-data.js (window.ResQMock.alerts),
        read through window.ResQStore so every page — and the future
        admin alert-management UI — shares one source of truth instead
        of each page duplicating a hardcoded array.
     ------------------------------------------------------------------ */
  function renderAlertRibbon() {
    const track = $("#ribbonTrack");
    if (!track) return;
    if (!window.ResQStore) return; // mock-data.js/store.js not loaded on this page

    const activeAlerts = window.ResQStore.getAll("alerts").filter((a) => a.active);
    const items = activeAlerts.map(
      (a) => `<li class="alert-ribbon__item"><span class="alert-ribbon__sev sev-${a.sev}">${a.sev.toUpperCase()}</span><span class="mono">${a.id}</span> — ${a.location} — ${a.title}</li>`
    ).join("");
    // Duplicate the list once so the CSS keyframe (-50%) loops seamlessly.
    track.querySelector("ul").innerHTML = items + items;

    const countEl = $("#ribbonCount");
    if (countEl) countEl.textContent = String(activeAlerts.length);
  }

  /* ------------------------------------------------------------------
     11. AUTHENTICATED SESSION & DYNAMIC HEADER
     ------------------------------------------------------------------ */
  function normalizeUserObject(u) {
    if (!u) return null;
    let raw = u;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!raw || typeof raw !== "object") return null;

    if (raw.data && typeof raw.data === "object" && (raw.data.name || raw.data.email || raw.data._id || raw.data.id)) {
      raw = raw.data;
    } else if (raw.user && typeof raw.user === "object" && (raw.user.name || raw.user.email || raw.user._id || raw.user.id)) {
      raw = raw.user;
    }

    const id = raw._id || raw.id || raw.userId || null;
    let name = raw.name || raw.fullName || raw.username || raw.displayName || "";
    if (!name && raw.email) {
      name = raw.email.split("@")[0];
    }

    const email = raw.email || "";
    const role = (raw.role || raw.userRole || "citizen").toLowerCase();
    const phone = raw.phone || raw.phoneNumber || "";

    return {
      _id: id,
      id: id,
      name: name || "Citizen",
      email: email,
      role: role,
      phone: phone,
      isActive: raw.isActive !== undefined ? raw.isActive : true
    };
  }

  function getAuthUser() {
    if (window.ResQStore && typeof window.ResQStore.getCurrentUser === "function") {
      const u = window.ResQStore.getCurrentUser();
      if (u) return normalizeUserObject(u);
    }
    try {
      const raw = sessionStorage.getItem("resq_current_user") ||
                  localStorage.getItem("resq_current_user") ||
                  sessionStorage.getItem("user") ||
                  localStorage.getItem("user");
      if (raw) return normalizeUserObject(JSON.parse(raw));
    } catch (e) {}
    return null;
  }

  function formatRole(role) {
    if (!role) return "Citizen";
    const r = String(role).toLowerCase().trim();
    if (r === "rescue" || r === "rescue team" || r === "rescueteam") return "Rescue Team Lead";
    if (r === "ngo" || r === "ngo coordinator") return "NGO Coordinator";
    if (r === "admin" || r === "administrator") return "Administrator";
    if (r === "volunteer") return "Volunteer";
    if (r === "citizen") return "Citizen";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function getDashboardForRole(role) {
    if (!role) return "citizen-dashboard.html";
    const r = String(role).toLowerCase().trim();
    if (r === "admin" || r === "administrator") return "admin-dashboard.html";
    if (r === "volunteer") return "volunteer-dashboard.html";
    if (r === "ngo" || r === "ngo coordinator") return "ngo-dashboard.html";
    if (r === "rescue" || r === "rescue team" || r === "rescueteam") return "rescue-dashboard.html";
    return "citizen-dashboard.html";
  }

  function getInitials(name) {
    if (!name || typeof name !== "string") return "U";
    const clean = name.trim();
    if (!clean) return "U";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) {
      return parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function updateAuthHeader(user) {
    if (!user) return;
    const name = user.name || user.fullName || user.username || (user.email ? user.email.split("@")[0] : "Citizen");
    const role = user.role || user.userRole || "citizen";
    const roleLabel = formatRole(role);
    const initials = getInitials(name);
    const targetDashboard = getDashboardForRole(role);

    // 1. Update user chip name
    document.querySelectorAll(".user-chip__name, [data-auth-name]").forEach((el) => {
      el.textContent = name;
    });

    // Also update any fallback user-chip spans if class is missing
    document.querySelectorAll(".user-chip").forEach((chip) => {
      const nameSpan = chip.querySelector(".user-chip__name, [data-auth-name]") || chip.querySelector("span span:first-child");
      if (nameSpan) nameSpan.textContent = name;

      const roleSpan = chip.querySelector(".user-chip__role, [data-auth-role]") || chip.querySelector("span span:last-child");
      if (roleSpan) roleSpan.textContent = roleLabel;

      const avatarEl = chip.querySelector(".avatar, [data-auth-avatar]");
      if (avatarEl) avatarEl.textContent = initials;
    });

    // 2. Update user chip role
    document.querySelectorAll(".user-chip__role, [data-auth-role]").forEach((el) => {
      el.textContent = roleLabel;
    });

    // 3. Update avatars
    document.querySelectorAll(".user-chip .avatar, button.user-chip .avatar, .dash-topbar .avatar, [data-auth-avatar]").forEach((el) => {
      el.textContent = initials;
    });

    const getEl = (id) => (typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById(id) : null);

    const pfAvatar = getEl("pfAvatar");
    if (pfAvatar) pfAvatar.textContent = initials;

    // 4. Update welcome greetings in dashboard headers
    const firstName = name.split(" ")[0];
    if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
      document.querySelectorAll(".dash-head h1").forEach((h1) => {
        if (h1.textContent.toLowerCase().includes("welcome back")) {
          h1.textContent = `Welcome back, ${firstName}`;
        }
      });
    }

    // 5. Update shared SOS details card
    const sharedName = getEl("sosSharedName");
    if (sharedName) sharedName.textContent = name;
    const sharedPhone = getEl("sosSharedPhone");
    if (sharedPhone && user.phone) sharedPhone.textContent = user.phone;

    // 6. Pre-fill profile page form inputs if present
    const pfName = getEl("pfName");
    const pfEmail = getEl("pfEmail");
    const pfPhone = getEl("pfPhone");
    if (pfName && !pfName.getAttribute("data-touched")) pfName.value = name;
    if (pfEmail && !pfEmail.getAttribute("data-touched")) pfEmail.value = user.email || "";
    if (pfPhone && user.phone && !pfPhone.getAttribute("data-touched")) pfPhone.value = user.phone;

    // 7. Update name in profile top header
    const profileNameDisplay = getEl("pfNameHeader") || (typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(".card .flex.items-center p[style*='font-weight:600']") : null);
    if (profileNameDisplay) profileNameDisplay.textContent = name;
    const profileRoleDisplay = getEl("pfRoleHeader") || (typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(".card .flex.items-center p[style*='font-size:13px']") : null);
    if (profileRoleDisplay) profileRoleDisplay.textContent = `${roleLabel} · Active Member`;

    // 8. Update Public Header / Navigation when logged in
    document.querySelectorAll(".site-header .nav-actions a[href='login.html'], .site-header .nav-actions [data-auth-login-btn]").forEach((btn) => {
      btn.setAttribute("href", targetDashboard);
      btn.textContent = "Dashboard";
      btn.setAttribute("data-auth-dash-btn", "true");
    });

    document.querySelectorAll(".site-header .nav-links a[href='login.html']").forEach((link) => {
      link.setAttribute("href", targetDashboard);
      link.textContent = "Dashboard";
    });

    const heroGetStarted = typeof document !== "undefined" && typeof document.querySelector === "function" ? document.querySelector(".hero-actions a[href='register.html'], .hero-actions a[href='login.html']") : null;
    if (heroGetStarted) {
      heroGetStarted.setAttribute("href", targetDashboard);
      heroGetStarted.textContent = "Go to Dashboard";
    }
  }

  function initAuthSession() {
    try {
      const user = getAuthUser();
      const loc = (typeof window !== "undefined" && window.location) ? window.location : (typeof location !== "undefined" ? location : { pathname: "index.html" });
      const cleanPath = (loc.pathname ? loc.pathname.split("/").pop() : "").split("?")[0].split("#")[0].toLowerCase();
      const filename = cleanPath || "index.html";
      const isProtectedDashboard = /^(citizen|volunteer|rescue|ngo|admin)-/.test(filename) && filename !== "volunteer-registration.html";

      if (isProtectedDashboard && !user) {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "login.html";
        }
        return;
      }

      if (user) {
        const targetDashboard = getDashboardForRole(user.role);

        // Dynamic Logo link routing for authenticated users: ensure logo always points to role dashboard
        if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
          document.querySelectorAll("a.logo, a[data-auth-logo], .dash-topbar a.logo, .site-header a.logo, .footer-brand a.logo").forEach((logo) => {
            logo.setAttribute("href", targetDashboard);
            logo.onclick = (e) => {
              e.preventDefault();
              const currentLoc = (typeof window !== "undefined" && window.location && window.location.pathname ? window.location.pathname.split("/").pop() : "").split("?")[0].toLowerCase() || "index.html";
              if (currentLoc !== targetDashboard.toLowerCase()) {
                if (typeof window !== "undefined" && window.location) {
                  window.location.href = targetDashboard;
                }
              }
            };
          });
        }

        updateAuthHeader(user);

        // 5. Wire up explicit log out links only
        if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
          document.querySelectorAll("a[href='login.html'], [data-auth-logout]").forEach((link) => {
            if (link.textContent.toLowerCase().includes("log out") || link.textContent.toLowerCase().includes("logout")) {
              link.addEventListener("click", () => {
                if (window.ResQStore && typeof window.ResQStore.clearCurrentUser === "function") {
                  window.ResQStore.clearCurrentUser();
                }
                try {
                  sessionStorage.removeItem("resq_current_user");
                  localStorage.removeItem("resq_current_user");
                  sessionStorage.removeItem("user");
                  localStorage.removeItem("user");
                } catch (err) {}
              });
            }
          });
        }
      } else {
        // Unauthenticated visitors: ensure logo points to index.html
        if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
          document.querySelectorAll("a.logo").forEach((logo) => {
            logo.setAttribute("href", "index.html");
          });
        }
      }
    } catch (e) {
      console.warn("initAuthSession notice:", e);
    }
  }

  function initFooterYear() {
    const y = new Date().getFullYear();
    if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
      document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = String(y);
      });
    }
  }

  window.ResQAuth = {
    getAuthUser,
    getDashboardForRole,
    initAuthSession,
    normalizeUserObject,
    getInitials,
    updateAuthHeader
  };

  // Run immediately in case DOM is ready
  if (typeof document !== "undefined") {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(initAuthSession, 0);
    }
  }

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", () => {
      initAuthSession();
      try { initTheme(); } catch (e) {}
      try { initMobileMenu(); } catch (e) {}
      try { highlightActiveNav(); } catch (e) {}
      try { initPopovers(); } catch (e) {}
      try { initModals(); } catch (e) {}
      try { initSmoothScroll(); } catch (e) {}
      try { initFormValidation(); } catch (e) {}
      try { initScrollReveal(); } catch (e) {}
      try { renderAlertRibbon(); } catch (e) {}
      try { initFooterYear(); } catch (e) {}
      initAuthSession();
    });
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pageshow", () => {
      initAuthSession();
    });
  }
})();

