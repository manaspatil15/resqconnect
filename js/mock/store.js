/* ==========================================================================
   ResQConnect — store.js
   Hybrid in-memory store and asynchronous backend synchronization layer.

       UI Components  <--->  ResQStore  <--->  ResQApi (js/api.js)
                                         <--->  MongoDB Atlas / Backend API

   Preserves synchronous read/write speed for instant UI rendering while
   seamlessly synchronizing with the backend REST API in the background.

   Load order: mock-data.js -> api.js -> store.js -> ui/*.js -> main.js -> dashboard.js
   ========================================================================== */

(function () {
  "use strict";

  if (!window.ResQMock) {
    console.error("ResQStore: mock-data.js must be loaded first.");
    return;
  }

  const STORAGE_KEY = "resqconnect_mock_state_v3";
  const USER_STORAGE_KEY = "resq_current_user";

  function loadPersisted() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const sameKeys = Object.keys(window.ResQMock).every((k) => Array.isArray(parsed[k]));
      return sameKeys ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage quota or private mode fallback
    }
  }

  const persisted = loadPersisted();
  const state = {};
  Object.keys(window.ResQMock).forEach((key) => {
    state[key] = persisted ? persisted[key] : window.ResQMock[key].map((item) => Object.assign({}, item));
  });

  const listeners = {}; // { collectionName: [callback, ...] }

  function notify(collection) {
    persist();
    (listeners[collection] || []).forEach((cb) => {
      try {
        cb(state[collection]);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function assertCollection(collection) {
    if (!state[collection]) {
      console.error(`ResQStore: unknown collection "${collection}"`);
      return false;
    }
    return true;
  }

  // Normalization Helpers to bridge MongoDB backend documents with frontend UI shapes
  function normalizeItem(collection, item) {
    if (!item) return item;
    const res = Object.assign({}, item);

    // Ensure id exists
    res.id = item.id || item._id || item.caseId || item.taskId || item.itemId || item.distributionId || item.reportId || item.referenceNumber || genId(collection);
    res._id = item._id || res.id;

    if (collection === "camps") {
      res.contact = res.contact || "";
      res.ngoPartner = res.ngoPartner || "";
    } else if (collection === "tasks") {
      res.org = (item.volunteerId && item.volunteerId.name) || res.org || "ResQConnect Support";
      res.meta = res.meta || [res.priority || "standard", res.location || "General"];
    } else if (collection === "inventory") {
      res.item = res.name || res.item;
      res.name = res.item;
    } else if (collection === "distributions") {
      res.camp = (item.campId && item.campId.name) || res.camp || "Relief Camp";
      res.item = item.itemName || res.item || (item.inventoryId && item.inventoryId.name) || "Supplies";
      res.createdAt = item.distributedAt || item.createdAt || new Date().toISOString();
    } else if (collection === "reports") {
      res.filedBy = (item.citizenId && item.citizenId.name) || res.filedBy || "Citizen";
      res.verified = item.status === "verified" || res.verified || false;
      if (!res.severity) res.severity = "watch";
    } else if (collection === "cases") {
      res.title = res.description || res.title || "Emergency Rescue Operation";
      res.reportedBy = (item.citizenId && item.citizenId.name) || res.reportedBy || null;
      res.reportedAt = item.createdAt || res.reportedAt || new Date().toISOString();
      res.respondedInMin = item.responseTime !== undefined ? item.responseTime : res.respondedInMin;
      res.sosId = (item.sosId && (item.sosId.referenceNumber || item.sosId._id)) || item.sosId || res.sosId || null;
    } else if (collection === "users") {
      res.status = item.isActive !== undefined ? (item.isActive ? "active" : "suspended") : (res.status || "active");
      res.joined = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : (res.joined || "Aug 2026");
    } else if (collection === "notifications") {
      res.read = item.isRead !== undefined ? item.isRead : (item.read !== undefined ? item.read : (res.read || false));
      res.message = item.message || item.title || res.message;
      res.title = item.title || res.title || "Notification";
      res.userId = (item.userId && (item.userId._id || item.userId.id)) || item.userId || res.userId || null;
      res.recipientId = res.userId;
      res.email = (item.userId && item.userId.email) || item.email || res.email || null;
      res.type = item.type || res.type || "info";
      res.relatedType = item.relatedType || res.relatedType || null;
      res.relatedId = item.relatedId || res.relatedId || null;
    }

    return res;
  }

  const ResQStore = {
    /** Returns the full array for a collection (live reference). */
    getAll(collection) {
      return assertCollection(collection) ? state[collection] : [];
    },

    /** Returns a single item by id, or undefined. */
    getById(collection, id) {
      if (!assertCollection(collection)) return undefined;
      return state[collection].find((item) => item.id === id || item._id === id || item.caseId === id || item.taskId === id || item.itemId === id || item.referenceNumber === id || item.reportId === id || item.distributionId === id);
    },

    /** Replaces the entire collection array. */
    setAll(collection, items) {
      if (!assertCollection(collection)) return;
      state[collection] = items.map((i) => normalizeItem(collection, i));
      notify(collection);
    },

    /** Adds a new item locally and asynchronously syncs to backend API. */
    add(collection, item) {
      if (!assertCollection(collection)) return null;
      const record = normalizeItem(collection, Object.assign({ id: item.id || genId(collection) }, item));
      state[collection].push(record);
      notify(collection);

      const currentUser = (window.ResQAuth && window.ResQAuth.getAuthUser()) || this.getCurrentUser();

      // Immediate local notification feedback for NGO actions
      if (collection === "inventory") {
        const ngoId = (currentUser && (currentUser._id || currentUser.id)) || item.ngoId;
        if (ngoId) {
          const localNotif = normalizeItem("notifications", {
            id: `N-NGO-${Date.now()}`,
            userId: ngoId,
            recipientId: ngoId,
            title: "Inventory Stock Added",
            message: `Added ${item.quantity} ${item.unit || "units"} of "${item.item || item.name}" to inventory (${item.id || item.itemId || ""}).`,
            type: "success",
            isRead: false,
            read: false,
            relatedType: "Inventory",
            relatedId: record._id || record.id,
            createdAt: new Date().toISOString()
          });
          state.notifications.unshift(localNotif);
          notify("notifications");
        }
      } else if (collection === "distributions") {
        const ngoId = (currentUser && (currentUser._id || currentUser.id)) || item.ngoId;
        if (ngoId) {
          const localNotif = normalizeItem("notifications", {
            id: `N-DIST-${Date.now()}`,
            userId: ngoId,
            recipientId: ngoId,
            title: "Distribution Logged",
            message: `${item.quantity} ${item.unit || "units"} of "${item.item || item.itemName}" dispatched to ${item.camp || "Relief Camp"}.`,
            type: "info",
            isRead: false,
            read: false,
            relatedType: "Distribution",
            relatedId: record._id || record.id,
            createdAt: new Date().toISOString()
          });
          state.notifications.unshift(localNotif);

          // Check if stock reached low stock threshold
          const invObj = this.getAll("inventory").find((i) => i.id === item.itemId || i._id === item.itemId || i.itemId === item.itemId || i.name === item.item || i.item === item.item);
          if (invObj && invObj.quantity <= (invObj.lowStockThreshold || 40)) {
            const lowNotif = normalizeItem("notifications", {
              id: `N-LOW-${Date.now() + 1}`,
              userId: ngoId,
              recipientId: ngoId,
              title: "Low Stock Alert",
              message: `Inventory item "${invObj.name || invObj.item}" (${invObj.itemId || invObj.id}) is low on stock (${invObj.quantity} ${invObj.unit || "units"} remaining).`,
              type: "warning",
              isRead: false,
              read: false,
              relatedType: "Inventory",
              relatedId: invObj._id || invObj.id,
              createdAt: new Date().toISOString()
            });
            state.notifications.unshift(lowNotif);
          }
          notify("notifications");
        }
      }

      // Asynchronous background API sync
      if (window.ResQApi) {
        (async () => {
          try {
            let res = null;

            if (collection === "sos") {
              res = await window.ResQApi.sos.create({
                citizenId: (currentUser && currentUser._id) || item.citizenId || "000000000000000000000001",
                location: typeof item.location === "object" ? (item.location.latitude ? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}` : "Location Shared") : item.location,
                description: item.description || "Citizen SOS Alert",
                priority: item.priority || "critical",
              });
              if (res && res.data && res.data.sos) {
                Object.assign(record, normalizeItem("sos", res.data.sos));
                notify(collection);
              }
            } else if (collection === "camps") {
              res = await window.ResQApi.camps.create({
                name: item.name,
                location: item.location,
                capacity: item.capacity || 100,
                occupancy: item.occupancy || 0,
                facilities: item.facilities || [],
                status: item.status || "active",
              });
              if (res && res.data) {
                Object.assign(record, normalizeItem("camps", res.data));
                notify(collection);
              }
            } else if (collection === "inventory") {
              res = await window.ResQApi.inventory.create({
                name: item.item || item.name,
                category: item.category || "General Supplies",
                quantity: item.quantity,
                capacity: item.capacity || item.quantity,
                unit: item.unit || "units",
                ngoId: (currentUser && (currentUser._id || currentUser.id)) || item.ngoId || null,
              });
              if (res && res.data) {
                Object.assign(record, normalizeItem("inventory", res.data));
                notify(collection);
                try {
                  const notifsRes = await window.ResQApi.notifications.getAll();
                  if (notifsRes && notifsRes.data && notifsRes.data.length > 0) {
                    state.notifications = notifsRes.data.map((n) => normalizeItem("notifications", n));
                    notify("notifications");
                  }
                } catch (nErr) {}
              }
            } else if (collection === "distributions") {
              // Find matching camp and inventory IDs if available
              const campObj = ResQStore.getAll("camps").find((c) => c.name === item.camp || c.id === item.camp || c._id === item.camp);
              const invObj = ResQStore.getAll("inventory").find((i) => i.id === item.itemId || i._id === item.itemId || i.itemId === item.itemId || i.name === item.item || i.item === item.item);

              const targetCampId = campObj ? (campObj._id || campObj.id || campObj.name) : (item.camp || "Relief Zone");
              const targetInvId = invObj ? (invObj._id || invObj.id || invObj.itemId) : (item.itemId || item.item);

              res = await window.ResQApi.distributions.log({
                ngoId: (currentUser && (currentUser._id || currentUser.id)) || null,
                campId: targetCampId,
                inventoryId: targetInvId,
                itemName: item.item || (invObj && (invObj.name || invObj.item)),
                quantity: item.quantity,
                notes: item.notes || "Standard distribution",
              });
              if (res && res.data) {
                const distData = res.data.distribution || res.data;
                Object.assign(record, normalizeItem("distributions", distData));
                if (res.remainingInventory && invObj) {
                  const currentInv = ResQStore.getById("inventory", invObj.id || invObj._id);
                  if (currentInv) {
                    currentInv.quantity = res.remainingInventory.quantity;
                    notify("inventory");
                  }
                }
                notify(collection);
                try {
                  const notifsRes = await window.ResQApi.notifications.getAll();
                  if (notifsRes && notifsRes.data && notifsRes.data.length > 0) {
                    state.notifications = notifsRes.data.map((n) => normalizeItem("notifications", n));
                    notify("notifications");
                  }
                } catch (nErr) {}
              }
            } else if (collection === "tasks") {
              res = await window.ResQApi.tasks.create({
                title: item.title,
                description: item.description || item.title,
                location: item.location || "General Area",
                priority: item.priority || "medium",
                dueDate: item.dueDate || null,
              });
              if (res && res.data) {
                Object.assign(record, normalizeItem("tasks", res.data));
                notify(collection);
              }
            } else if (collection === "reports") {
              res = await window.ResQApi.reports.create({
                citizenId: (currentUser && currentUser._id) || "000000000000000000000001",
                type: item.type || "General Incident",
                title: item.title || `${item.type || "Report"} at ${item.location}`,
                description: item.description || "",
                location: item.location || "Unknown Location",
              });
              if (res && res.data) {
                Object.assign(record, normalizeItem("reports", res.data));
                notify(collection);
              }
            } else if (collection === "users") {
              res = await window.ResQApi.auth.register({
                name: item.name,
                email: item.email,
                password: item.password || "password123",
                role: item.role || "citizen",
                phone: item.phone,
              });
              if (res && res.data) {
                Object.assign(record, normalizeItem("users", res.data));
                notify(collection);
              }
            }
          } catch (err) {
            console.warn(`ResQStore: async add for "${collection}" saved locally only:`, err.message);
          }
        })();
      }

      return record;
    },

    /** Shallow-merges `patch` into the item matching `id` locally and syncs to backend. */
    update(collection, id, patch) {
      if (!assertCollection(collection)) return null;
      const item = this.getById(collection, id);
      if (!item) return null;
      Object.assign(item, patch);
      notify(collection);

      // Real-time volunteer task lifecycle notification dispatch
      if (collection === "tasks" && patch.status) {
        const currentUser = (window.ResQAuth && window.ResQAuth.getAuthUser()) || this.getCurrentUser();
        const vId = (currentUser && (currentUser._id || currentUser.id)) || patch.volunteerId;
        const notifMessages = {
          accepted: { title: "Task Accepted", message: `You have accepted task "${item.title}" (${item.taskId || item.id || ""}).`, type: "info" },
          in_progress: { title: "Task In Progress", message: `Task "${item.title}" is now active.`, type: "info" },
          completed: { title: "Task Completed", message: `You completed task "${item.title}". Great work!`, type: "success" }
        };
        const nInfo = notifMessages[patch.status];
        if (nInfo && vId) {
          const localNotif = normalizeItem("notifications", {
            id: `N-VOL-${Date.now()}`,
            userId: vId,
            recipientId: vId,
            title: nInfo.title,
            message: nInfo.message,
            type: nInfo.type,
            isRead: false,
            read: false,
            relatedType: "VolunteerTask",
            relatedId: item._id || item.id,
            createdAt: new Date().toISOString()
          });
          state.notifications.unshift(localNotif);
          notify("notifications");
        }
      }

      // Asynchronous background API sync
      if (window.ResQApi) {
        (async () => {
          try {
            const targetId = item._id || item.id || id;
            if (collection === "cases" && patch.status) {
              await window.ResQApi.rescueCases.updateStatus(targetId, patch.status, patch.outcome);
            } else if (collection === "tasks" && patch.status) {
              const currentUser = (window.ResQAuth && window.ResQAuth.getAuthUser()) || ResQStore.getCurrentUser();
              const vId = (currentUser && (currentUser._id || currentUser.id)) || patch.volunteerId;
              await window.ResQApi.tasks.updateStatus(targetId, patch.status, vId);
              try {
                const notifsRes = await window.ResQApi.notifications.getAll();
                if (notifsRes && notifsRes.data && notifsRes.data.length > 0) {
                  state.notifications = notifsRes.data.map((n) => normalizeItem("notifications", n));
                  notify("notifications");
                }
              } catch (nErr) {}
            } else if (collection === "reports") {
              if (patch.verified === true || patch.status === "verified" || patch.status === "assigned") {
                const currentUser = ResQStore.getCurrentUser();
                await window.ResQApi.reports.verify(targetId, (currentUser && currentUser._id) || null);
              } else if (patch.status === "closed" || patch.status === "rejected") {
                await window.ResQApi.reports.reject(targetId);
              } else {
                await window.ResQApi.reports.update(targetId, patch);
              }
            } else if (collection === "users") {
              const userPatch = Object.assign({}, patch);
              if (patch.status) userPatch.isActive = patch.status === "active";
              await window.ResQApi.users.update(targetId, userPatch);
            } else if (collection === "camps") {
              await window.ResQApi.camps.update(targetId, patch);
            } else if (collection === "inventory") {
              await window.ResQApi.inventory.update(targetId, patch);
            } else if (collection === "notifications" && patch.read !== undefined) {
              if (patch.read) await window.ResQApi.notifications.markRead(targetId);
            }
          } catch (err) {
            console.warn(`ResQStore: async update for "${collection}/${id}" saved locally only:`, err.message);
          }
        })();
      }

      return item;
    },

    /** Removes the item matching `id` locally and syncs delete to backend. */
    remove(collection, id) {
      if (!assertCollection(collection)) return false;
      const item = this.getById(collection, id);
      const before = state[collection].length;
      state[collection] = state[collection].filter((i) => i.id !== id && i._id !== id);

      if (state[collection].length !== before) {
        notify(collection);

        if (window.ResQApi && item) {
          (async () => {
            try {
              const targetId = item._id || item.id || id;
              if (collection === "camps") await window.ResQApi.camps.delete(targetId);
              else if (collection === "tasks") await window.ResQApi.tasks.delete(targetId);
              else if (collection === "inventory") await window.ResQApi.inventory.delete(targetId);
              else if (collection === "reports") await window.ResQApi.reports.delete(targetId);
              else if (collection === "users") await window.ResQApi.users.delete(targetId);
              else if (collection === "notifications") await window.ResQApi.notifications.delete(targetId);
            } catch (err) {
              console.warn(`ResQStore: async delete for "${collection}/${id}" removed locally only:`, err.message);
            }
          })();
        }
        return true;
      }
      return false;
    },

    /** Subscribes to changes on a collection. Returns an unsubscribe function. */
    subscribe(collection, callback) {
      if (!assertCollection(collection)) return () => {};
      listeners[collection] = listeners[collection] || [];
      listeners[collection].push(callback);
      return () => {
        listeners[collection] = listeners[collection].filter((cb) => cb !== callback);
      };
    },

    /** Session current-user management */
    getCurrentUser() {
      try {
        const raw = sessionStorage.getItem(USER_STORAGE_KEY) ||
                    localStorage.getItem(USER_STORAGE_KEY) ||
                    sessionStorage.getItem("user") ||
                    localStorage.getItem("user");
        if (!raw) return null;
        let user = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (user && user.data && typeof user.data === "object") user = user.data;
        if (user && user.user && typeof user.user === "object") user = user.user;
        if (user) {
          if (!user.id && user._id) user.id = user._id;
          if (!user._id && user.id) user._id = user.id;
          if (!user.name && user.fullName) user.name = user.fullName;
          if (!user.name && user.username) user.name = user.username;
          if (!user.name && user.email) user.name = user.email.split("@")[0];
        }
        return user;
      } catch (e) {
        return null;
      }
    },

    setCurrentUser(user) {
      if (!user) return;
      let raw = user;
      if (raw.data && typeof raw.data === "object") raw = raw.data;
      if (raw.user && typeof raw.user === "object") raw = raw.user;
      const normalized = Object.assign({}, raw);
      if (!normalized.id && normalized._id) normalized.id = normalized._id;
      if (!normalized._id && normalized.id) normalized._id = normalized.id;
      if (!normalized.name && normalized.fullName) normalized.name = normalized.fullName;
      if (!normalized.name && normalized.username) normalized.name = normalized.username;
      if (!normalized.name && normalized.email) normalized.name = normalized.email.split("@")[0];
      try {
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
        sessionStorage.setItem("user", JSON.stringify(normalized));
        localStorage.setItem("user", JSON.stringify(normalized));
      } catch (e) {}
      if (typeof window !== "undefined" && window.ResQAuth && typeof window.ResQAuth.initAuthSession === "function") {
        try { window.ResQAuth.initAuthSession(); } catch (err) {}
      }
    },

    clearCurrentUser() {
      try {
        sessionStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        sessionStorage.removeItem("user");
        localStorage.removeItem("user");
      } catch (e) {}
    },

    /** Synchronizes all collections with the backend MongoDB database */
    async syncWithBackend() {
      if (!window.ResQApi) return;
      try {
        const results = await Promise.allSettled([
          window.ResQApi.camps.getAll(),
          window.ResQApi.tasks.getAll(),
          window.ResQApi.inventory.getAll(),
          window.ResQApi.distributions.getAll(),
          window.ResQApi.reports.getAll(),
          window.ResQApi.rescueCases.getAll(),
          window.ResQApi.sos.getAll(),
          window.ResQApi.users.getAll(),
          window.ResQApi.notifications.getAll(),
        ]);

        const [campsRes, tasksRes, invRes, distRes, reportsRes, casesRes, sosRes, usersRes, notifsRes] = results;

        if (campsRes.status === "fulfilled" && campsRes.value.data && campsRes.value.data.length > 0) {
          state.camps = campsRes.value.data.map((c) => normalizeItem("camps", c));
          notify("camps");
        }
        if (tasksRes.status === "fulfilled" && tasksRes.value.data && tasksRes.value.data.length > 0) {
          state.tasks = tasksRes.value.data.map((t) => normalizeItem("tasks", t));
          notify("tasks");
        }
        if (invRes.status === "fulfilled" && invRes.value.data && invRes.value.data.length > 0) {
          state.inventory = invRes.value.data.map((i) => normalizeItem("inventory", i));
          notify("inventory");
        }
        if (distRes.status === "fulfilled" && distRes.value.data && distRes.value.data.length > 0) {
          state.distributions = distRes.value.data.map((d) => normalizeItem("distributions", d));
          notify("distributions");
        }
        if (reportsRes.status === "fulfilled" && reportsRes.value.data && reportsRes.value.data.length > 0) {
          state.reports = reportsRes.value.data.map((r) => normalizeItem("reports", r));
          notify("reports");
        }
        if (casesRes.status === "fulfilled" && casesRes.value.data && casesRes.value.data.length > 0) {
          state.cases = casesRes.value.data.map((c) => normalizeItem("cases", c));
          notify("cases");
        }
        if (sosRes.status === "fulfilled" && sosRes.value.data && sosRes.value.data.length > 0) {
          state.sos = sosRes.value.data.map((s) => normalizeItem("sos", s));
          notify("sos");
        }
        if (usersRes.status === "fulfilled" && usersRes.value.data && usersRes.value.data.length > 0) {
          state.users = usersRes.value.data.map((u) => normalizeItem("users", u));
          notify("users");
        }
        if (notifsRes.status === "fulfilled" && notifsRes.value.data && notifsRes.value.data.length > 0) {
          state.notifications = notifsRes.value.data.map((n) => normalizeItem("notifications", n));
          notify("notifications");
        }
      } catch (e) {
        console.warn("ResQStore: backend sync completed with fallback:", e.message);
      }
    },

    /** Clears all session changes and restores the original seed. */
    resetToSeed() {
      Object.keys(window.ResQMock).forEach((key) => {
        state[key] = window.ResQMock[key].map((item) => Object.assign({}, item));
      });
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      Object.keys(state).forEach(notify);
    },
  };

  // Reference-number generator, e.g. genId("sos") -> "SOS-2026-04821"
  const PREFIXES = {
    sos: "SOS",
    reports: "RPT",
    missingPersons: "MP",
    helpRequests: "HR",
    alerts: "DA",
    camps: "CMP",
    tasks: "TSK",
    cases: "RS",
    inventory: "INV",
    distributions: "DIST",
    notifications: "N",
    users: "U",
  };

  function genId(collection) {
    const prefix = PREFIXES[collection] || (collection ? collection.slice(0, 3).toUpperCase() : "REC");
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
  }
  ResQStore.genId = genId;

  // Auto-init backend sync on load
  if (typeof window !== "undefined") {
    setTimeout(() => {
      ResQStore.syncWithBackend();
    }, 100);
  }

  window.ResQStore = ResQStore;
})();
