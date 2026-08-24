/* ==========================================================================
   ResQConnect — api.js
   Lightweight HTTP Client for connecting to the ResQConnect Express Backend API.
   ========================================================================== */

(function () {
  "use strict";

  const API_BASE = window.RESQ_API_BASE || "https://resqconnect-backend.onrender.com/api";

  async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = Object.assign(
      {
        "Content-Type": "application/json",
      },
      options.headers || {}
    );

    const config = {
      method: options.method || "GET",
      headers,
    };

    if (options.body && (config.method === "POST" || config.method === "PUT" || config.method === "PATCH")) {
      config.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));

      if (!response.ok) {
        const errorMsg = data && data.message ? data.message : `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        console.warn(`ResQConnect API: Backend server unreachable at ${url}. Falling back to local store.`);
      }
      throw err;
    }
  }

  function buildQuery(params) {
    if (!params) return "";
    const filtered = {};
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "" && params[key] !== "all") {
        filtered[key] = params[key];
      }
    });
    const qs = new URLSearchParams(filtered).toString();
    return qs ? `?${qs}` : "";
  }

  const ResQApi = {
    baseUrl: API_BASE,

    // Health check
    health: {
      check: () => request("/health"),
    },

    // Authentication
    auth: {
      register: (userData) => request("/auth/register", { method: "POST", body: userData }),
      login: (credentials) => request("/auth/login", { method: "POST", body: credentials }),
    },

    // Users
    users: {
      getAll: (params) => request(`/users${buildQuery(params)}`),
      getById: (id) => request(`/users/${id}`),
      update: (id, data) => request(`/users/${id}`, { method: "PUT", body: data }),
      delete: (id) => request(`/users/${id}`, { method: "DELETE" }),
    },

    // Citizen SOS
    sos: {
      create: (sosData) => request("/sos", { method: "POST", body: sosData }),
      getAll: (params) => request(`/sos${buildQuery(params)}`),
      getById: (id) => request(`/sos/${id}`),
      updateStatus: (id, status) => request(`/sos/${id}/status`, { method: "PATCH", body: { status } }),
    },

    // Rescue Cases
    rescueCases: {
      getAll: (params) => request(`/rescue-cases${buildQuery(params)}`),
      getById: (id) => request(`/rescue-cases/${id}`),
      create: (data) => request("/rescue-cases", { method: "POST", body: data }),
      updateStatus: (id, status, outcome) =>
        request(`/rescue-cases/${id}/status`, { method: "PATCH", body: { status, outcome } }),
      assign: (id, assignedTo) =>
        request(`/rescue-cases/${id}/assign`, { method: "PATCH", body: { assignedTo } }),
    },

    // Relief Camps
    camps: {
      getAll: (params) => request(`/camps${buildQuery(params)}`),
      getById: (id) => request(`/camps/${id}`),
      create: (campData) => request("/camps", { method: "POST", body: campData }),
      update: (id, campData) => request(`/camps/${id}`, { method: "PUT", body: campData }),
      delete: (id) => request(`/camps/${id}`, { method: "DELETE" }),
    },

    // Volunteer Tasks
    tasks: {
      getAll: (params) => request(`/tasks${buildQuery(params)}`),
      getById: (id) => request(`/tasks/${id}`),
      create: (taskData) => request("/tasks", { method: "POST", body: taskData }),
      updateStatus: (id, status, volunteerId) =>
        request(`/tasks/${id}/status`, { method: "PATCH", body: { status, volunteerId } }),
      update: (id, taskData) => request(`/tasks/${id}`, { method: "PUT", body: taskData }),
      delete: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
    },

    // NGO Inventory
    inventory: {
      getAll: (params) => request(`/inventory${buildQuery(params)}`),
      getById: (id) => request(`/inventory/${id}`),
      create: (itemData) => request("/inventory", { method: "POST", body: itemData }),
      update: (id, itemData) => request(`/inventory/${id}`, { method: "PUT", body: itemData }),
      delete: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
    },

    // NGO Distributions
    distributions: {
      getAll: (params) => request(`/distributions${buildQuery(params)}`),
      getById: (id) => request(`/distributions/${id}`),
      log: (distData) => request("/distributions", { method: "POST", body: distData }),
    },

    // Reports (Citizen & Admin)
    reports: {
      getAll: (params) => request(`/reports${buildQuery(params)}`),
      getById: (id) => request(`/reports/${id}`),
      create: (reportData) => request("/reports", { method: "POST", body: reportData }),
      verify: (id, verifiedBy) =>
        request(`/reports/${id}/verify`, { method: "PATCH", body: { verifiedBy } }),
      reject: (id) => request(`/reports/${id}/reject`, { method: "PATCH" }),
      update: (id, data) => request(`/reports/${id}`, { method: "PUT", body: data }),
      delete: (id) => request(`/reports/${id}`, { method: "DELETE" }),
    },

    // Notifications
    notifications: {
      getAll: (params) => request(`/notifications${buildQuery(params)}`),
      create: (notifData) => request("/notifications", { method: "POST", body: notifData }),
      markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
      markAllRead: (userId) => request("/notifications/read-all", { method: "PATCH", body: { userId } }),
      delete: (id) => request(`/notifications/${id}`, { method: "DELETE" }),
    },
  };

  window.ResQApi = ResQApi;
})();
