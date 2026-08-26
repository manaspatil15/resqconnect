const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load frontend dependencies
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const toastCode = fs.readFileSync(path.join(__dirname, '../js/ui/toast.js'), 'utf8');
const renderTableCode = fs.readFileSync(path.join(__dirname, '../js/ui/render-table.js'), 'utf8');
const demoFormCode = fs.readFileSync(path.join(__dirname, '../js/ui/demo-form.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

console.log('=== TESTING MISSING PERSON REPORT COMPLETE LIFECYCLE ===\n');

const storage = {};
global.window = {
  location: { pathname: '/citizen-missing.html' },
  sessionStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
  localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
  addEventListener: () => {},
  CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
};
global.document = {
  readyState: 'complete',
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {},
  body: { style: {} }
};
global.sessionStorage = global.window.sessionStorage;
global.localStorage = global.window.localStorage;

eval(mockDataCode);
eval(storeCode);
eval(toastCode);
eval(renderTableCode);
eval(demoFormCode);
eval(mainJsCode);

// 1. Initial State Check
const initialList = window.ResQStore.getAll("missingPersons");
assert(Array.isArray(initialList), "missingPersons collection should exist");
const initialCount = initialList.length;
console.log(`✔ Initial missing persons in store: ${initialCount}`);

// 2. Submit New Missing Person Report
const newReport = window.ResQStore.add("missingPersons", {
  name: "Rajesh Kumar",
  age: 42,
  gender: "Male",
  lastSeen: "Kurla Terminus",
  lastSeenAt: new Date().toISOString(),
  description: "Red shirt and grey trousers",
  status: "reported",
  photo: null
});

assert(newReport && newReport.id, "Submitted report must be assigned a unique ID");
assert.strictEqual(newReport.status, "reported", "New report status must be 'reported'");
console.log(`✔ 1. Report Created: ${newReport.id} (${newReport.name}) [Status: ${newReport.status}]`);

// 3. Verify Active List Display
const activeReports = window.ResQStore.getAll("missingPersons").filter(p => p.status === "reported" || p.status === "investigating");
assert(activeReports.some(p => p.id === newReport.id), "New report must appear in active list");
console.log(`✔ 2. Active List Verification: ${newReport.id} present in active reports.`);

// 4. Execute "Person Found / Close Report" Action
const updatedRecord = window.ResQStore.update("missingPersons", newReport.id, { status: "found" });
assert.strictEqual(updatedRecord.status, "found", "Status must update to 'found'");
console.log(`✔ 3. Mark Found Action: ${newReport.id} status updated to '${updatedRecord.status}'.`);

// 5. Verify Removal from Active List & Presence in Found Filter
const activeAfterFound = window.ResQStore.getAll("missingPersons").filter(p => p.status === "reported" || p.status === "investigating");
assert(!activeAfterFound.some(p => p.id === newReport.id), "Found report must disappear from active filter list");

const foundReports = window.ResQStore.getAll("missingPersons").filter(p => p.status === "found");
assert(foundReports.some(p => p.id === newReport.id), "Found report must appear in 'found' list");
console.log(`✔ 4. Scoping Verification: ${newReport.id} moved from active to found category.`);

// 6. Verify Persistence across Refresh Simulation
const persistedRaw = sessionStorage.getItem("resqconnect_mock_state_v3");
assert(persistedRaw, "State must be persisted in sessionStorage");
const persistedParsed = JSON.parse(persistedRaw);
const persistedItem = persistedParsed.missingPersons.find(p => p.id === newReport.id);
assert(persistedItem && persistedItem.status === "found", "Report must remain 'found' in persisted storage");
console.log(`✔ 5. Refresh Persistence: ${newReport.id} remains 'found' after simulated reload.`);

// 7. Cleanup
const cleaned = window.ResQStore.getAll("missingPersons").filter(p => p.id !== newReport.id);
window.ResQStore.getAll("missingPersons").length = 0;
cleaned.forEach(p => window.ResQStore.getAll("missingPersons").push(p));

console.log('\n===========================================================');
console.log('✔ MISSING PERSON REPORT LIFECYCLE TEST PASSED 100%');
console.log('===========================================================');
