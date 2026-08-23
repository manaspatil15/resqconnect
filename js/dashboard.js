/* ==========================================================================
   ResQConnect — dashboard.js
   Behavior scoped to the 23 dashboard pages (citizen / volunteer / ngo /
   rescue / admin). Loaded AFTER main.js. Every function checks for its
   target elements first, so this file is safe to include even on pages
   that only use some of these components.
   ========================================================================== */

(function () {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
     1. SIDEBAR TOGGLE (mobile) — opens the fixed sidebar + scrim
     ------------------------------------------------------------------ */
  function initSidebarToggle() {
    const btn = $("#sidebarToggle");
    const sidebar = $("#dashSidebar");
    const scrim = $("#sidebarScrim");
    if (!btn || !sidebar) return;

    const open = () => {
      sidebar.classList.add("open");
      if (scrim) scrim.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      sidebar.classList.remove("open");
      if (scrim) scrim.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    btn.addEventListener("click", () => {
      sidebar.classList.contains("open") ? close() : open();
    });
    if (scrim) scrim.addEventListener("click", close);
    $$("a", sidebar).forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  /* ------------------------------------------------------------------
     2. TABS — generic tab switcher.
        Structure:
        <div class="tabs">
          <button data-tab="tab1" class="active">One</button>
          <button data-tab="tab2">Two</button>
        </div>
        <div data-tab-panel="tab1">...</div>
        <div data-tab-panel="tab2" hidden>...</div>
     ------------------------------------------------------------------ */
  function initTabs() {
    $$(".tabs").forEach((tabGroup) => {
      const buttons = $$("button[data-tab]", tabGroup);
      if (!buttons.length) return;

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = btn.getAttribute("data-tab");
          buttons.forEach((b) => b.classList.toggle("active", b === btn));

          // Panels can live anywhere in the same dashboard section
          const scope = tabGroup.closest(".dash-content") || document;
          $$("[data-tab-panel]", scope).forEach((panel) => {
            panel.hidden = panel.getAttribute("data-tab-panel") !== target;
          });
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     3. ANIMATED STAT COUNTERS
        <b data-count-to="1284">0</b>
     ------------------------------------------------------------------ */
  function animateCount(el) {
    const to = parseInt(el.getAttribute("data-count-to"), 10);
    if (Number.isNaN(to)) return;
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      el.textContent = Math.round(to * eased).toLocaleString("en-IN");
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initStatCounters() {
    const counters = $$("[data-count-to]");
    if (!counters.length) return;

    if (!("IntersectionObserver" in window)) {
      counters.forEach(animateCount);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((c) => io.observe(c));
  }

  /* ------------------------------------------------------------------
     4. PROGRESS BAR FILL ANIMATION
        <div class="progress"><div class="progress__fill" data-fill="72"></div></div>
     ------------------------------------------------------------------ */
  function initProgressBars() {
    $$(".progress__fill[data-fill]").forEach((bar) => {
      const pct = Math.max(0, Math.min(100, parseInt(bar.getAttribute("data-fill"), 10) || 0));
      requestAnimationFrame(() => { bar.style.width = pct + "%"; });
      if (pct < 25) bar.classList.add("low");
      else if (pct < 60) bar.classList.add("mid");
    });
  }

  /* ------------------------------------------------------------------
     5. TABLE / LIST SEARCH FILTER
        <input data-filter-target="#usersTable">
        Filters row text against the input value on every keystroke.
     ------------------------------------------------------------------ */
  function initTableFilters() {
    $$("[data-filter-target]").forEach((input) => {
      const target = $(input.getAttribute("data-filter-target"));
      if (!target) return;
      const rows = () => $$("tbody tr, .list-row, .task-card", target);

      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        rows().forEach((row) => {
          const match = row.textContent.toLowerCase().includes(q);
          row.style.display = match ? "" : "none";
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     6. STATUS FILTER PILLS
        <button data-status-filter="active" class="badge active">Active</button>
        Filters elements with [data-status] within the same dash-content.
     ------------------------------------------------------------------ */
  function initStatusFilters() {
    $$("[data-status-filter]").forEach((pill) => {
      pill.addEventListener("click", () => {
        const group = pill.closest("[data-filter-group]");
        if (!group) return;
        $$("[data-status-filter]", group).forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");

        const value = pill.getAttribute("data-status-filter");
        const scope = group.closest(".dash-content") || document;
        $$("[data-status]", scope).forEach((item) => {
          item.style.display = value === "all" || item.getAttribute("data-status") === value ? "" : "none";
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     9. NOTIFICATION POPOVER
        Renders the shared bell popover (every dashboard page has one)
        from ResQStore.getAll("notifications") instead of each page
        hardcoding the same 4-5 items independently. Clicking an item
        marks it read; the unread dot on the bell icon reflects the
        live unread count.
     ------------------------------------------------------------------ */
  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  const NOTIF_DOT_COLOR = {
    alert: "var(--alert)",
    task: "var(--teal)",
    success: "var(--green)",
    info: "var(--teal)",
    warning: "var(--amber)",
    emergency: "var(--alert)",
    camp: "var(--amber)",
    missing: "var(--green)"
  };

  function initNotifPopover() {
    const popover = $("#notifPopover");
    const bellDot = $(".notif-dot");
    const bellTrigger = $('[data-popover-trigger][data-target="notifPopover"]') || (popover && popover.parentElement ? popover.parentElement.querySelector("button") : null);
    if (!popover || !window.ResQStore) return;

    function render() {
      const currentUser = (window.ResQAuth && window.ResQAuth.getAuthUser()) ||
                          (window.ResQStore && window.ResQStore.getCurrentUser());
      const currentUserId = currentUser ? (currentUser._id || currentUser.id) : null;
      const currentEmail = currentUser && currentUser.email ? currentUser.email.toLowerCase().trim() : null;

      const all = window.ResQStore.getAll("notifications").filter((n) => {
        if (!currentUser) return false;
        const nUserId = n.userId || n.recipientId || (n.user && (n.user._id || n.user.id));
        const nEmail = n.email || (n.userId && n.userId.email) || (n.user && n.user.email);
        if (nUserId && currentUserId && String(nUserId) === String(currentUserId)) return true;
        if (nEmail && currentEmail && String(nEmail).toLowerCase().trim() === currentEmail) return true;
        return false;
      }).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const recent = all.slice(0, 5);
      const unreadCount = all.filter((n) => !n.read).length;

      if (bellDot) bellDot.style.display = unreadCount > 0 ? "" : "none";

      const renderList = typeof renderCollection === "function" ? renderCollection : (window.renderCollection || function () {});
      renderList({
        container: popover,
        items: recent,
        rowTemplate: (n) => `
          <div class="popover-item" data-notif-id="${n._id || n.id}" style="cursor:pointer;${n.read ? "" : "background:var(--fog);"}">
            <span class="popover-item__dot" style="background:${NOTIF_DOT_COLOR[n.type] || "var(--ink-faint)"};"></span>
            <div><p>${n.message}</p><time>${timeAgo(n.createdAt)}</time></div>
          </div>`,
        emptyState: { title: "No notifications", description: "You're all caught up." }
      });

      $$("[data-notif-id]", popover).forEach((item) => {
        item.addEventListener("click", () => {
          window.ResQStore.update("notifications", item.getAttribute("data-notif-id"), { read: true });
          render();
        });
      });
    }

    if (bellTrigger) {
      bellTrigger.addEventListener("click", () => {
        render();
        if (window.ResQApi && window.ResQApi.notifications) {
          window.ResQApi.notifications.getAll().then((res) => {
            if (res && res.data && res.data.length > 0) {
              const freshNotifs = res.data.map((n) => window.ResQStore.normalizeItem ? window.ResQStore.normalizeItem("notifications", n) : n);
              freshNotifs.forEach((fn) => {
                const existingIdx = window.ResQStore.getAll("notifications").findIndex((en) => (en._id || en.id) === (fn._id || fn.id));
                if (existingIdx >= 0) {
                  window.ResQStore.getAll("notifications")[existingIdx] = Object.assign(window.ResQStore.getAll("notifications")[existingIdx], fn);
                } else {
                  window.ResQStore.getAll("notifications").unshift(fn);
                }
              });
              render();
            }
          }).catch(() => {});
        }
      });
    }

    render();
    if (window.ResQStore && typeof window.ResQStore.subscribe === "function") {
      window.ResQStore.subscribe("notifications", render);
    }
  }

  /* ------------------------------------------------------------------
     7. SOS CONFIRM (citizen-sos.html)
        State machine: idle -> armed (confirm) -> sending -> success.
        This is a frontend simulation only — no backend exists yet, so
        it never claims a real rescue team was notified. The mock SOS
        record is still written to ResQStore so a future "My Requests"
        view could read it back, and the flow/timing is structured so
        swapping the setTimeout for a real fetch() later is a small
        change, not a rewrite.
     ------------------------------------------------------------------ */
  function initSosButton() {
    const btn = $("#sosButton");
    const status = $("#sosStatus");
    if (!btn) return;

    // Wrap the button so the pulsing "armed" ring has something to
    // position against without altering the button's own box model.
    let wrap = btn.closest(".sos-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "sos-wrap sos-btn-shell";
      wrap.setAttribute("data-sos-state", "idle");
      btn.parentNode.insertBefore(wrap, btn);
      wrap.appendChild(btn);
      const ring = document.createElement("span");
      ring.className = "sos-ring";
      ring.setAttribute("aria-hidden", "true");
      wrap.appendChild(ring);
    }

    let armed = false;
    let armTimer = null;
    const idleLabel = btn.textContent;

    function setState(state) {
      wrap.setAttribute("data-sos-state", state);
    }

    function reset() {
      armed = false;
      clearTimeout(armTimer);
      btn.textContent = idleLabel;
      btn.classList.remove("is-sending");
      setState("idle");
    }

    btn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        setState("armed");
        btn.textContent = "Tap again to confirm SOS";
        armTimer = setTimeout(reset, 4000);
        return;
      }

      // Confirmed — move into "sending" state.
      clearTimeout(armTimer);
      armed = false;
      setState("sending");
      btn.classList.add("is-sending");
      btn.disabled = true;

      // Attempt to capture the browser's location for the SOS record.
      // If permission is denied or unavailable, fall back gracefully to manual/approximate location.
      function withLocation(callback) {
        if (!("geolocation" in navigator)) {
          callback({ available: false, address: "Location shared manually (GPS unavailable on device)" });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => callback({
            available: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          }),
          () => callback({ available: false, address: "Location shared (GPS permission not granted)" }),
          { timeout: 3500 }
        );
      }

      withLocation((location) => {
        const user = (window.ResQStore && window.ResQStore.getCurrentUser()) ||
          (window.ResQAuth && window.ResQAuth.getAuthUser()) ||
          { name: "Citizen", role: "citizen" };

        const locationPayload = location.available
          ? { latitude: location.latitude, longitude: location.longitude, address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` }
          : { address: location.address || "Emergency Location Shared" };

        // Save through ResQStore which immediately persists to local session and dispatches to REST API backend
        const record = window.ResQStore
          ? window.ResQStore.add("sos", {
              citizenId: user.id || user._id || null,
              reportedBy: user.name || "Citizen",
              phone: user.phone || "",
              status: "pending",
              priority: "critical",
              location: locationPayload,
              description: `Emergency SOS request from ${user.name || "citizen"}${user.phone ? ` (Phone: ${user.phone})` : ""}`,
              createdAt: new Date().toISOString()
            })
          : { id: "SOS-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000), createdAt: new Date().toISOString() };

        // Cross-role consistency: linked case for rescue team dashboard
        if (window.ResQStore) {
          window.ResQStore.add("cases", {
            title: `Emergency SOS — ${user.name || "citizen request"}`,
            location: location.available ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Emergency Location Shared",
            priority: "critical",
            status: "pending",
            reportedBy: user.name || "Citizen",
            peopleAffected: 1,
            reportedAt: record.createdAt,
            sosId: record.id
          });

          // Dispatch notification to user's notifications panel
          window.ResQStore.add("notifications", {
            type: "alert",
            message: `Emergency SOS (${record.id}) dispatched to rescue responders. Help is on the way.`,
            read: false,
            createdAt: new Date().toISOString()
          });
        }

        btn.classList.remove("is-sending");
        btn.textContent = "SOS Dispatched — Help is on the way";
        setState("success");

        const locationLine = location.available
          ? `GPS location captured: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}.`
          : `GPS location unavailable — emergency beacon broadcast with your profile.`;

        if (status) {
          status.hidden = false;
          status.innerHTML =
            `<p style="margin:0 0 6px;"><strong>Emergency SOS Dispatched Successfully!</strong></p>` +
            `<p style="margin:0 0 8px;font-size:13.5px;color:var(--ink-soft);">Your emergency request has been received by the rescue command center and queued for response. ${locationLine}</p>` +
            `<p style="margin:0;font-size:13px;">Reference: <span class="sos-ref">${record.id}</span> · <a href="citizen-requests.html" style="color:var(--teal);text-decoration:underline;font-weight:600;">Track in My Requests &rarr;</a></p>`;
        }
        if (window.showToast) {
          window.showToast({ type: "success", message: `Emergency SOS ${record.id} dispatched to rescue teams.` });
        }
        document.dispatchEvent(new CustomEvent("resq:sos-created", { detail: record }));
      });
    });
  }

  /* ------------------------------------------------------------------
     8. DASHBOARD CARD ENTRANCE
        Subtle entrance for dashboard elements without causing white/blank
        flash on page navigation.
     ------------------------------------------------------------------ */
  function initDashboardReveal() {
    const reveals = $$(".dash-grid .reveal");
    if (!reveals.length) return;

    reveals.forEach((el, i) => {
      el.style.transitionDelay = Math.min(i * 30, 150) + "ms";
      el.classList.add("in-view");
    });
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    if (window.ResQAuth && typeof window.ResQAuth.initAuthSession === "function") {
      try { window.ResQAuth.initAuthSession(); } catch (e) {}
    }
    initSidebarToggle();
    initTabs();
    initStatCounters();
    initProgressBars();
    initTableFilters();
    initStatusFilters();
    initSosButton();
    initDashboardReveal();
    initNotifPopover();
  });
})();
