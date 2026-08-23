const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== VERIFYING RUNTIME CITIZEN AUTH, SOS CREATION & REQUEST FILTERING ===\n');

// 1. Load mock data & store in sandbox
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

// Set up mock DOM / browser environment
const storage = {};
global.window = {
  location: { pathname: "/citizen-requests.html" },
  sessionStorage: {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  localStorage: {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } },
  document: {
    addEventListener: () => {},
    dispatchEvent: () => {},
    documentElement: { setAttribute: () => {}, removeAttribute: () => {} },
    querySelector: () => null,
    querySelectorAll: () => []
  }
};
global.document = global.window.document;
global.sessionStorage = global.window.sessionStorage;
global.localStorage = global.window.localStorage;
global.CustomEvent = global.window.CustomEvent;

eval(mockDataCode);
eval(storeCode);
eval(mainJsCode);

console.log('1. Testing User Authentication & Header Normalization:');
const testUser = {
  _id: "6a8ae23227abd697f5ed424c",
  name: "ABC",
  email: "abc@g.com",
  role: "citizen",
  phone: "1234567890",
  isActive: true
};

window.ResQStore.setCurrentUser(testUser);

const authUser = window.ResQAuth.getAuthUser();
assert.strictEqual(authUser.name, "ABC", "User name must normalize to ABC");
assert.strictEqual(authUser.role, "citizen", "User role must normalize to citizen");
assert.strictEqual(authUser.id, "6a8ae23227abd697f5ed424c", "User id must match ObjectId");

const initials = window.ResQAuth.getInitials(authUser.name);
assert.strictEqual(initials, "AB", "Avatar initials for 'ABC' must be 'AB'");

console.log('   ✔ Logged-in user dynamically retrieved:', authUser.name);
console.log('   ✔ User role formatted:', authUser.role);
console.log('   ✔ Avatar initials dynamically generated:', initials);

console.log('\n2. Testing Request Filtering in Citizen Requests:');

// Replicate isCitizenItem & combinedItems logic from citizen-requests.html
function isCitizenItem(item, user) {
  if (!item || !user) return false;
  const userId = String(user.id || user._id || "");
  const userName = (user.name || user.fullName || user.username || "").trim().toLowerCase();
  const userEmail = (user.email || "").trim().toLowerCase();

  if (item.citizenId) {
    if (typeof item.citizenId === "string" || typeof item.citizenId === "number") {
      if (String(item.citizenId) === userId && userId.length > 0) return true;
    } else if (typeof item.citizenId === "object") {
      const cId = String(item.citizenId._id || item.citizenId.id || "");
      if (cId === userId && userId.length > 0) return true;
      if (item.citizenId.email && item.citizenId.email.toLowerCase() === userEmail && userEmail.length > 0) return true;
      if (item.citizenId.name && item.citizenId.name.trim().toLowerCase() === userName && userName.length > 0) return true;
    }
  }
  if (item.userId && String(item.userId) === userId && userId.length > 0) return true;
  if (userName.length > 0) {
    if (item.filedBy && typeof item.filedBy === "string" && item.filedBy.trim().toLowerCase() === userName) return true;
    if (item.reportedBy && typeof item.reportedBy === "string" && item.reportedBy.trim().toLowerCase() === userName) return true;
    if (item.requestedBy && typeof item.requestedBy === "string" && item.requestedBy.trim().toLowerCase() === userName) return true;
  }
  if (userEmail.length > 0 && item.email && typeof item.email === "string" && item.email.trim().toLowerCase() === userEmail) {
    return true;
  }
  return false;
}

function getCitizenRequests(user) {
  const sos = window.ResQStore.getAll("sos")
    .filter(s => isCitizenItem(s, user))
    .map(s => ({ id: s.id, kind: "Emergency SOS", type: s.priority, createdAt: s.createdAt }));

  const reports = window.ResQStore.getAll("reports")
    .filter(r => isCitizenItem(r, user))
    .map(r => ({ id: r.id, kind: "Disaster Report", type: r.type, createdAt: r.createdAt }));

  const requests = window.ResQStore.getAll("helpRequests")
    .filter(r => isCitizenItem(r, user))
    .map(r => ({ id: r.id, kind: "Help Request", type: r.title, createdAt: r.createdAt }));

  return sos.concat(reports, requests);
}

// Initial state: No requests submitted yet by user ABC
const initialRequests = getCitizenRequests(authUser);
console.log('   • Initial requests for user ABC (before creating any):', initialRequests.length);
assert.strictEqual(initialRequests.length, 0, "Demo/mock records from other users (e.g. RPT-2026-0144, HR-2026-0512) must NOT appear in My Requests");
console.log('   ✔ Unrelated demo records successfully excluded from user ABC requests.');

console.log('\n3. Creating Real SOS and Disaster Report for user ABC:');
const createdSOS = window.ResQStore.add("sos", {
  citizenId: authUser.id,
  reportedBy: authUser.name,
  phone: authUser.phone,
  location: "19.0760, 72.8777",
  description: "Water rising rapidly near home, need assistance",
  priority: "critical",
  status: "pending"
});
console.log('   • Created SOS Record:', createdSOS.id, '(citizenId:', createdSOS.citizenId, ')');

const createdReport = window.ResQStore.add("reports", {
  citizenId: authUser.id,
  filedBy: authUser.name,
  type: "Flood",
  severity: "high",
  location: "Bandra West, Mumbai",
  description: "Street flooded, traffic stopped",
  status: "reviewing"
});
console.log('   • Created Disaster Report:', createdReport.id, '(citizenId:', createdReport.citizenId, ')');

const userRequestsAfter = getCitizenRequests(authUser);
console.log('   • Requests visible to user ABC after submission:', userRequestsAfter.length);
assert.strictEqual(userRequestsAfter.length, 2, "Both the created SOS and Disaster Report must be returned");
assert.strictEqual(userRequestsAfter[0].id, createdSOS.id, "Created SOS must be present in citizen requests");
assert.strictEqual(userRequestsAfter[1].id, createdReport.id, "Created Disaster Report must be present in citizen requests");
console.log('   ✔ Only user ABC own requests are visible in My Requests.');

console.log('\n4. Testing Other Citizen Isolation:');
const otherUser = {
  _id: "6a8ae99999abd697f5ed9999",
  name: "Other Citizen",
  email: "other@example.com",
  role: "citizen"
};
const otherRequests = getCitizenRequests(otherUser);
console.log('   • Requests visible to Other Citizen:', otherRequests.length);
assert.strictEqual(otherRequests.length, 0, "Other citizen must NOT see user ABC's SOS or reports");
console.log('   ✔ Multi-user data isolation verified.');

console.log('\n===========================================================');
console.log('✔ ALL RUNTIME FRONTEND AUTH & FILTERING CHECKS PASSED (100%)');
console.log('===========================================================');
