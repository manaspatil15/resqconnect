require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Report = require('./models/Report');
const Camp = require('./models/Camp');
const Notification = require('./models/Notification');
const Inventory = require('./models/Inventory');
const userController = require('./controllers/userController');
const reportController = require('./controllers/reportController');
const campController = require('./controllers/campController');

console.log('=== STARTING ADMIN PLATFORM WORKFLOW TESTS ===\n');

// Load frontend scripts into mock DOM environment for frontend assertion
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // 1. Verify User ABC Exists & Test Admin Header Dynamics
  const citizenUser = await User.findOne({ email: 'abc@g.com' });
  assert(citizenUser, 'Citizen user abc@g.com must exist in database');
  console.log(`✔ Real User Account Verified: ${citizenUser.name} (${citizenUser.email})`);

  const adminUser = {
    _id: "6a8ae6666666666666666666",
    name: "Ananya Iyer",
    email: "ananya.iyer@resqconnect.org",
    role: "admin",
    phone: "9876543213"
  };

  const storage = { resq_current_user: JSON.stringify(adminUser) };
  global.window = {
    location: { pathname: "/admin-dashboard.html" },
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
  assert.strictEqual(authUser.name, "Ananya Iyer", "Admin user name must normalize to Ananya Iyer");
  assert.strictEqual(authUser.role, "admin", "Admin user role must normalize to admin");
  
  const initials = window.ResQAuth.getInitials(authUser.name);
  assert.strictEqual(initials, "AI", "Initials for 'Ananya Iyer' must be 'AI'");
  console.log(`✔ Admin Header Dynamics: Name='${authUser.name}', Role='${authUser.role}', Initials='${initials}'`);

  // Helper for mock HTTP res
  function createMockRes() {
    const res = {
      statusCode: null,
      data: null,
      status: (code) => { res.statusCode = code; return res; },
      json: (data) => { res.data = data; return res; }
    };
    return res;
  }

  // 2. Test User Management: Fetch Users, Create Test User, Update Status
  console.log('\n--- 1. Testing User Management ---');
  let req = { query: {} };
  let res = createMockRes();
  await userController.getAllUsers(req, res);
  assert.strictEqual(res.statusCode, 200, "Get users should return HTTP 200");
  assert(res.data.data.length > 0, "Users list should contain registered users");
  console.log(`✔ Fetched ${res.data.data.length} registered users from MongoDB Atlas.`);

  const tempUser = await User.create({
    name: "Temp User",
    email: `temp_${Date.now()}@example.com`,
    password: "password123",
    role: "citizen",
    status: "active",
    isActive: true
  });

  // Admin suspends temp user
  req = { params: { id: tempUser._id.toString() }, body: { status: "suspended", isActive: false } };
  res = createMockRes();
  await userController.updateUser(req, res);
  assert.strictEqual(res.statusCode, 200, "User update should return HTTP 200");

  const updatedTempUser = await User.findById(tempUser._id);
  assert.strictEqual(updatedTempUser.status, "suspended", "User status in DB must be suspended");
  assert.strictEqual(updatedTempUser.isActive, false, "User isActive in DB must be false");
  console.log(`✔ User status update verified in DB: ${updatedTempUser.name} is now ${updatedTempUser.status}`);

  // 3. Test Volunteer Approval
  console.log('\n--- 2. Testing Volunteer Management & Approval ---');
  const tempVolunteer = await User.create({
    name: "Volunteer Candidate",
    email: `vol_${Date.now()}@example.com`,
    password: "password123",
    role: "volunteer",
    status: "pending",
    isActive: true
  });

  req = { params: { id: tempVolunteer._id.toString() }, body: { status: "active", isActive: true } };
  res = createMockRes();
  await userController.updateUser(req, res);
  assert.strictEqual(res.statusCode, 200, "Volunteer approval should return HTTP 200");

  const approvedVolunteer = await User.findById(tempVolunteer._id);
  assert.strictEqual(approvedVolunteer.status, "active", "Volunteer status must be updated to active");
  console.log(`✔ Volunteer approval verified in DB: ${approvedVolunteer.name} status is now active`);

  // 4. Test Report Verification & Rejection Workflow with Citizen Notifications
  console.log('\n--- 3. Testing Report Management & Cross-Role Workflow ---');
  // Citizen ABC creates report
  const createdReport1 = await Report.create({
    reportId: `RPT-TEST-${Date.now().toString().slice(-4)}`,
    citizenId: citizenUser._id,
    type: "Water Logging & Flooding",
    title: "Severe water logging at Hindmata flyover",
    description: "Water level is 3 feet high, vehicles stranded.",
    location: "Hindmata, Dadar, Mumbai",
    status: "pending"
  });
  console.log(`✔ Citizen Report Created: ${createdReport1.reportId} (Status: ${createdReport1.status})`);

  // Admin verifies report
  req = { params: { id: createdReport1._id.toString() }, body: { verifiedBy: adminUser._id } };
  res = createMockRes();
  await reportController.verifyReport(req, res);
  assert.strictEqual(res.statusCode, 200, "Report verification should return HTTP 200");

  const reportAfterVerify = await Report.findById(createdReport1._id);
  assert.strictEqual(reportAfterVerify.status, "verified", "Report status in DB must be verified");
  console.log(`✔ Report Verification Verified in DB: ${reportAfterVerify.reportId} status is verified`);

  const notifVerified = await Notification.findOne({ userId: citizenUser._id, relatedId: createdReport1._id, title: /Report Verified/i });
  assert(notifVerified, "Citizen notification must be generated on report verification");
  console.log(`✔ Citizen Notification Generated: "${notifVerified.title}" - "${notifVerified.message}"`);

  // Test Report Rejection
  const createdReport2 = await Report.create({
    reportId: `RPT-TEST-${(Date.now() + 1).toString().slice(-4)}`,
    citizenId: citizenUser._id,
    type: "Road Blockage",
    title: "Minor tree branch on pavement",
    description: "Pavement partially blocked.",
    location: "Bandra West, Mumbai",
    status: "pending"
  });

  req = { params: { id: createdReport2._id.toString() }, body: {} };
  res = createMockRes();
  await reportController.rejectReport(req, res);
  assert.strictEqual(res.statusCode, 200, "Report rejection should return HTTP 200");

  const reportAfterReject = await Report.findById(createdReport2._id);
  assert.strictEqual(reportAfterReject.status, "rejected", "Report status in DB must be rejected");
  console.log(`✔ Report Rejection Verified in DB: ${reportAfterReject.reportId} status is rejected`);

  // 5. Test Relief Camp Creation and Updates
  console.log('\n--- 4. Testing Relief Camp Creation & Management ---');
  req = {
    body: {
      name: "Sion Community Relief Shelter",
      location: "Sion East, Mumbai",
      capacity: 450,
      occupancy: 0,
      status: "active"
    }
  };
  res = createMockRes();
  await campController.createCamp(req, res);
  assert.strictEqual(res.statusCode, 201, "Camp creation should return HTTP 201");
  const createdCamp = res.data.data;
  console.log(`✔ Relief Camp Created: ${createdCamp.name} (Capacity: ${createdCamp.capacity})`);

  // Admin updates occupancy
  req = { params: { id: createdCamp._id.toString() }, body: { occupancy: 150 } };
  res = createMockRes();
  await campController.updateCamp(req, res);
  assert.strictEqual(res.statusCode, 200, "Camp update should return HTTP 200");

  const campAfterUpdate = await Camp.findById(createdCamp._id);
  assert.strictEqual(campAfterUpdate.occupancy, 150, "Camp occupancy in DB must be updated to 150");
  console.log(`✔ Relief Camp Update Verified in DB: Occupancy is now ${campAfterUpdate.occupancy}/${campAfterUpdate.capacity}`);

  // 6. Cleanup Temporary Test Records
  console.log('\n--- Cleaning up temporary test records ---');
  await User.findByIdAndDelete(tempUser._id);
  await User.findByIdAndDelete(tempVolunteer._id);
  await Report.findByIdAndDelete(createdReport1._id);
  await Report.findByIdAndDelete(createdReport2._id);
  await Camp.findByIdAndDelete(createdCamp._id);
  await Notification.deleteMany({ relatedId: { $in: [createdReport1._id, createdReport2._id] } });
  console.log('✔ Temporary test records cleaned up. Real user accounts remain intact.');

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ ALL ADMIN PLATFORM WORKFLOW CHECKS PASSED (100%)');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
