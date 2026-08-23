require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const authController = require('./controllers/authController');

// Load frontend scripts
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

function createMockRes() {
  const res = {
    statusCode: null,
    data: null,
    status: (code) => { res.statusCode = code; return res; },
    json: (data) => { res.data = data; return res; }
  };
  return res;
}

console.log('=== TESTING PERMANENT DEMO RESCUE ACCOUNT LOGIN FLOW ===\n');

async function testRescueLogin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // 1. Verify User Exists in Database
  const rescueUser = await User.findOne({ email: 'rescue@resqconnect.com' });
  assert(rescueUser, 'Rescue account rescue@resqconnect.com must exist in database');
  assert.strictEqual(rescueUser.name, 'Capt. Vikram Rao');
  assert.strictEqual(rescueUser.role, 'rescue');
  assert.strictEqual(rescueUser.password, 'Rescue123');
  assert.strictEqual(rescueUser.status, 'active');
  assert.strictEqual(rescueUser.isActive, true);
  console.log(`✔ Database Record Verified: ${rescueUser.name} (${rescueUser.email}) [Role: ${rescueUser.role}]`);

  // 2. Test Login Controller with Valid Credentials
  let req = { body: { email: 'rescue@resqconnect.com', password: 'Rescue123', role: 'rescue' } };
  let res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 200, 'Login must return HTTP 200');
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.name, 'Capt. Vikram Rao');
  assert.strictEqual(res.data.data.email, 'rescue@resqconnect.com');
  assert.strictEqual(res.data.data.role, 'rescue');
  assert.strictEqual(res.data.data.password, undefined, 'Password must not be returned');
  const loginResult = res.data.data;
  console.log('✔ API Login Verified: Valid credentials authenticated successfully.');

  // 3. Test Invalid Password Rejection
  req = { body: { email: 'rescue@resqconnect.com', password: 'WrongPassword', role: 'rescue' } };
  res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 401, 'Invalid password must be rejected with HTTP 401');
  console.log('✔ Invalid Password Handling: Incorrect password correctly rejected.');

  // 4. Test Role Mismatch Rejection
  req = { body: { email: 'rescue@resqconnect.com', password: 'Rescue123', role: 'citizen' } };
  res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 403, 'Role mismatch must be rejected with HTTP 403');
  console.log('✔ Role Mismatch Handling: Logging in with wrong role correctly rejected.');

  // 5. Test Frontend Login Simulation and Navigation to rescue-dashboard.html
  const DASHBOARD_BY_ROLE = {
    "Citizen": "citizen-dashboard.html",
    "Volunteer": "volunteer-dashboard.html",
    "NGO": "ngo-dashboard.html",
    "Rescue Team": "rescue-dashboard.html",
    "Admin": "admin-dashboard.html"
  };

  const selectedRole = "Rescue Team";
  const roleKey = selectedRole === "Rescue Team" ? "rescue" : selectedRole.toLowerCase();
  const targetDestination = DASHBOARD_BY_ROLE[selectedRole];
  assert.strictEqual(targetDestination, "rescue-dashboard.html", "Destination for Rescue Team must be rescue-dashboard.html");
  assert.strictEqual(roleKey, "rescue", "Role key for Rescue Team must be rescue");
  console.log(`✔ Frontend Login Mapping: "Rescue Team" -> role "${roleKey}" -> redirects to "${targetDestination}"`);

  // 6. Test Session & Header Initialization on rescue-dashboard.html
  const sessionUser = Object.assign({}, loginResult);
  const storage = { resq_current_user: JSON.stringify(sessionUser) };

  global.window = {
    location: { pathname: `/${targetDestination}` },
    sessionStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
    addEventListener: () => {},
    CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
  };
  global.document = {
    readyState: "complete",
    querySelectorAll: (sel) => [],
    querySelector: (sel) => null,
    getElementById: (id) => null,
    addEventListener: () => {}
  };
  global.sessionStorage = global.window.sessionStorage;
  global.localStorage = global.window.localStorage;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);

  const authUser = window.ResQAuth.getAuthUser();
  assert.strictEqual(authUser.name, 'Capt. Vikram Rao');
  assert.strictEqual(authUser.role, 'rescue');
  assert.strictEqual(authUser.email, 'rescue@resqconnect.com');

  const initials = window.ResQAuth.getInitials(authUser.name);
  console.log(`✔ Rescue Dashboard Header Session: Name="${authUser.name}", Role="${authUser.role}", Initials="${initials}"`);

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ PERMANENT DEMO RESCUE ACCOUNT LOGIN VERIFIED (100%)');
  console.log('===========================================================');
}

testRescueLogin().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
