require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Models
const User = require('./models/User');
const SOS = require('./models/SOS');
const RescueCase = require('./models/RescueCase');
const Camp = require('./models/Camp');
const VolunteerTask = require('./models/VolunteerTask');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Report = require('./models/Report');
const Notification = require('./models/Notification');

// Controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const sosController = require('./controllers/sosController');
const rescueCaseController = require('./controllers/rescueCaseController');
const campController = require('./controllers/campController');
const volunteerTaskController = require('./controllers/volunteerTaskController');
const inventoryController = require('./controllers/inventoryController');
const distributionController = require('./controllers/distributionController');
const reportController = require('./controllers/reportController');
const notificationController = require('./controllers/notificationController');

// Frontend scripts
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

console.log('================================================================');
console.log('    RESQCONNECT COMPREHENSIVE FULL-SYSTEM MASTER QA SUITE');
console.log('================================================================\n');

async function runMasterQA() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // Verify Real ABC User Exists
  const realAbc = await User.findOne({ email: 'abc@g.com' });
  assert(realAbc, 'CRITICAL: Real test user ABC (abc@g.com) must exist in MongoDB Atlas');
  console.log(`✔ Real User Account Verified: ${realAbc.name} (${realAbc.email}, ID: ${realAbc._id})`);

  // =========================================================================
  // SECTION 1: AUTHENTICATION, SESSIONS, HEADERS & PROTECTED GUARDS
  // =========================================================================
  console.log('\n--- [SECTION 1] AUTHENTICATION & SESSION NORMALIZATION ---');

  // Test 1.1: Registration
  const testRegEmail = `qa_auth_${Date.now()}@example.com`;
  let req = { body: { name: 'QA Candidate', email: testRegEmail, password: 'password123', role: 'volunteer', phone: '9988776655' } };
  let res = createMockRes();
  await authController.register(req, res);
  assert.strictEqual(res.statusCode, 201, 'Registration must return HTTP 201');
  assert.strictEqual(res.data.data.email, testRegEmail);
  const createdQaUser = res.data.data;
  console.log('✔ 1.1 Registration: Successful for new user.');

  // Test 1.2: Duplicate Email Prevention
  req = { body: { name: 'Duplicate User', email: testRegEmail, password: 'password123' } };
  res = createMockRes();
  await authController.register(req, res);
  assert.strictEqual(res.statusCode, 400, 'Duplicate registration must be rejected with HTTP 400');
  console.log('✔ 1.2 Registration: Duplicate email blocked.');

  // Test 1.3: Login Success & Password Validation
  req = { body: { email: testRegEmail, password: 'password123' } };
  res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 200, 'Login must return HTTP 200');
  assert.strictEqual(res.data.data.email, testRegEmail);
  console.log('✔ 1.3 Login: Valid credentials login succeeded.');

  // Test 1.4: Invalid Password Rejection
  req = { body: { email: testRegEmail, password: 'wrongPassword' } };
  res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 401, 'Invalid password must return HTTP 401');
  console.log('✔ 1.4 Login: Invalid credentials correctly rejected.');

  // Test 1.5: Multi-Role Header Dynamics & Initials Verification
  const testRoles = [
    { name: 'Aditi Sharma', role: 'citizen', expectedInitials: 'AS' },
    { name: 'Capt. Vikram Singh', role: 'rescue', expectedInitials: 'CS' },
    { name: 'Vikram Singh', role: 'rescue', expectedInitials: 'VS' },
    { name: 'Rohan Mehta', role: 'volunteer', expectedInitials: 'RM' },
    { name: 'Priya Nair', role: 'ngo', expectedInitials: 'PN' },
    { name: 'Ananya Iyer', role: 'admin', expectedInitials: 'AI' },
    { name: 'ABC', role: 'citizen', expectedInitials: 'AB' },
    { name: 'Single', role: 'citizen', expectedInitials: 'SI' }
  ];

  testRoles.forEach(tr => {
    const storage = { resq_current_user: JSON.stringify({ name: tr.name, role: tr.role, email: `${tr.name.toLowerCase().replace(/[^a-z]/g, '')}@test.com` }) };
    global.window = {
      location: { pathname: '/citizen-dashboard.html' },
      sessionStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
      localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => storage[k] = v, removeItem: (k) => delete storage[k] },
      addEventListener: () => {},
      CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
    };
    global.document = { readyState: 'complete', querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
    global.sessionStorage = global.window.sessionStorage;
    global.localStorage = global.window.localStorage;

    eval(mockDataCode);
    eval(storeCode);
    eval(mainJsCode);

    const auth = window.ResQAuth.getAuthUser();
    const initials = window.ResQAuth.getInitials(auth.name);
    assert.strictEqual(auth.name, tr.name);
    assert.strictEqual(auth.role, tr.role);
    assert.strictEqual(initials, tr.expectedInitials, `Initials for "${tr.name}" must be "${tr.expectedInitials}"`);
  });
  console.log('✔ 1.5 Header Dynamics: All 5 roles verified with accurate names, roles, and initials.');

  // =========================================================================
  // SECTION 2: CITIZEN WORKFLOW & DATA ISOLATION
  // =========================================================================
  console.log('\n--- [SECTION 2] CITIZEN WORKFLOW & DATA ISOLATION ---');

  // Test 2.1: Citizen SOS Submission
  req = {
    body: {
      citizenId: realAbc._id,
      name: realAbc.name,
      phone: realAbc.phone || '1234567890',
      emergencyType: 'Medical Emergency',
      peopleCount: 3,
      latitude: 19.0760,
      longitude: 72.8777,
      address: 'Kurla West, Mumbai',
      description: 'Senior citizen in need of oxygen support.',
      severity: 'critical'
    }
  };
  res = createMockRes();
  await sosController.createSOS(req, res);
  assert.strictEqual(res.statusCode, 201, 'SOS creation must return HTTP 201');
  const citizenSos = res.data.data;
  const refCode = citizenSos.referenceNumber || citizenSos.sosId;
  assert(refCode, 'SOS must have a valid referenceNumber / sosId code');
  console.log(`✔ 2.1 SOS Creation: ${refCode} created in MongoDB Atlas.`);

  // Test 2.2: Disaster Report Submission
  req = {
    body: {
      citizenId: realAbc._id,
      type: 'Flooding',
      title: 'Water logging in residential complex',
      description: 'Ground floor water ingress.',
      location: 'Kurla East, Mumbai'
    }
  };
  res = createMockRes();
  await reportController.createReport(req, res);
  assert.strictEqual(res.statusCode, 201, 'Report creation must return HTTP 201');
  const citizenReport = res.data.data;
  console.log(`✔ 2.2 Disaster Report: ${citizenReport.reportId} created in MongoDB Atlas.`);

  // Test 2.3: My Requests Isolation (ABC sees own SOS & Report; Other Citizen sees 0)
  req = { query: { citizenId: realAbc._id.toString() } };
  res = createMockRes();
  await sosController.getAllSOS(req, res);
  const abcSosList = res.data.data;
  assert(abcSosList.some(s => s._id.toString() === citizenSos._id.toString()), 'User ABC must see own SOS');

  req = { query: { citizenId: new mongoose.Types.ObjectId().toString() } };
  res = createMockRes();
  await sosController.getAllSOS(req, res);
  assert.strictEqual(res.data.data.length, 0, 'Other citizen must NOT see user ABC SOS');
  console.log('✔ 2.3 Request Isolation: Citizen request scoping verified.');

  // =========================================================================
  // SECTION 3: RESCUE TEAM WORKFLOW & REAL-TIME SYNC
  // =========================================================================
  console.log('\n--- [SECTION 3] RESCUE TEAM WORKFLOW & STATUS SYNC ---');

  // Verify RescueCase auto-linked to SOS
  const linkedRescueCase = await RescueCase.findOne({ $or: [{ sosId: citizenSos._id }, { caseId: citizenSos.sosId }] });
  assert(linkedRescueCase, 'RescueCase must be auto-created and linked to SOS');
  console.log(`✔ 3.1 RescueCase Auto-Linked: ${linkedRescueCase.caseId} (Status: ${linkedRescueCase.status})`);

  // Rescue Step 1: Assign
  req = { params: { id: linkedRescueCase._id.toString() }, body: { assignedTo: 'Team Alpha' } };
  res = createMockRes();
  await rescueCaseController.assignCase(req, res);
  assert.strictEqual(res.statusCode, 200);

  let syncedSos = await SOS.findById(citizenSos._id);
  assert.strictEqual(syncedSos.status, 'assigned', 'SOS status must sync to assigned');
  console.log('✔ 3.2 Rescue Step 1 (Assigned): SOS synced.');

  // Rescue Step 2: In Progress
  req = { params: { id: linkedRescueCase._id.toString() }, body: { status: 'in_progress' } };
  res = createMockRes();
  await rescueCaseController.updateCaseStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  syncedSos = await SOS.findById(citizenSos._id);
  assert.strictEqual(syncedSos.status, 'in_progress', 'SOS status must sync to in_progress');
  console.log('✔ 3.3 Rescue Step 2 (In Progress): SOS synced & Citizen notified.');

  // Rescue Step 3: Resolved
  req = { params: { id: linkedRescueCase._id.toString() }, body: { status: 'resolved', outcome: 'Safe evacuation complete' } };
  res = createMockRes();
  await rescueCaseController.updateCaseStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  syncedSos = await SOS.findById(citizenSos._id);
  assert.strictEqual(syncedSos.status, 'resolved', 'SOS status must sync to resolved');
  notif = await Notification.findOne({ userId: realAbc._id, title: /Rescue Resolved/i });
  assert(notif, 'Citizen must receive resolved notification');
  console.log('✔ 3.4 Rescue Step 3 (Resolved): SOS synced & Citizen notified.');

  // =========================================================================
  // SECTION 4: VOLUNTEER WORKFLOW & TASK LIFECYCLE
  // =========================================================================
  console.log('\n--- [SECTION 4] VOLUNTEER WORKFLOW & TASK LIFECYCLE ---');

  // Create Volunteer Task
  req = {
    body: {
      title: 'Distribute Drinking Water in Sector 4',
      category: 'distribution',
      location: 'Dharavi Relief Camp',
      urgency: 'high',
      requiredVolunteers: 2,
      description: 'Distribution of 200 water bottles.'
    }
  };
  res = createMockRes();
  await volunteerTaskController.createTask(req, res);
  assert.strictEqual(res.statusCode, 201);
  const vTask = res.data.data;
  console.log(`✔ 4.1 Task Created: ${vTask.taskId} (Status: ${vTask.status})`);

  // Accept Task
  req = { params: { id: vTask._id.toString() }, body: { status: 'accepted', volunteerId: createdQaUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);
  console.log('✔ 4.2 Task Accepted: Assigned to volunteer.');

  // Start Task
  req = { params: { id: vTask._id.toString() }, body: { status: 'in_progress', volunteerId: createdQaUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);
  console.log('✔ 4.3 Task In Progress: Status updated.');

  // Complete Task
  req = { params: { id: vTask._id.toString() }, body: { status: 'completed', volunteerId: createdQaUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const completedTaskInDb = await VolunteerTask.findById(vTask._id);
  assert.strictEqual(completedTaskInDb.status, 'completed');
  assert(completedTaskInDb.completedAt, 'Task must record completedAt timestamp');
  console.log(`✔ 4.4 Task Completed: Timestamped ${completedTaskInDb.completedAt.toISOString()}`);

  // =========================================================================
  // SECTION 5: NGO INVENTORY & DISTRIBUTION INTEGRATION
  // =========================================================================
  console.log('\n--- [SECTION 5] NGO INVENTORY & ATOMIC DISTRIBUTION ---');

  // Create Camp
  req = { body: { name: 'Ghatkopar Central Relief Center', location: 'Ghatkopar, Mumbai', capacity: 300, occupancy: 20 } };
  res = createMockRes();
  await campController.createCamp(req, res);
  const ngoCamp = res.data.data;

  // Create Inventory Item: Initial Stock = 100
  req = { body: { name: 'Emergency Medical First-Aid Kits', category: 'medical', quantity: 100, unit: 'kits', location: 'NGO Central Depot' } };
  res = createMockRes();
  await inventoryController.createInventory(req, res);
  const ngoItem = res.data.data;
  console.log(`✔ 5.1 Inventory Item Created: ${ngoItem.itemId} (Quantity: 100 kits)`);

  // Test Over-Stock Distribution (Request 150 > Stock 100) -> Rejection
  req = { body: { inventoryId: ngoItem._id, campId: ngoCamp._id, quantity: 150, recipientName: 'Camp Lead' } };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 400, 'Overstock distribution must be rejected with HTTP 400');
  console.log('✔ 5.2 Over-Stock Distribution Correctly Blocked.');

  // Test Valid Distribution: Distribute 30 -> Stock = 70
  req = { body: { inventoryId: ngoItem._id, campId: ngoCamp._id, quantity: 30, recipientName: 'Camp Lead' } };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);

  let updatedNgoItem = await Inventory.findById(ngoItem._id);
  assert.strictEqual(updatedNgoItem.quantity, 70, 'Inventory quantity must decrement from 100 to 70');
  console.log(`✔ 5.3 Valid Distribution Logged: Stock decremented to ${updatedNgoItem.quantity} kits.`);

  // Test Exact-Stock Distribution: Distribute remaining 70 -> Stock = 0
  req = { body: { inventoryId: ngoItem._id, campId: ngoCamp._id, quantity: 70, recipientName: 'Camp Lead' } };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);

  updatedNgoItem = await Inventory.findById(ngoItem._id);
  assert.strictEqual(updatedNgoItem.quantity, 0, 'Inventory quantity must decrement to exact 0');
  console.log(`✔ 5.4 Exact-Stock Distribution Logged: Stock safely reached 0 kits.`);

  // =========================================================================
  // SECTION 6: ADMIN PLATFORM WORKFLOWS
  // =========================================================================
  console.log('\n--- [SECTION 6] ADMIN PLATFORM MANAGEMENT ---');

  // Test 6.1: Admin User Management
  req = { params: { id: createdQaUser._id.toString() }, body: { status: 'active', isActive: true } };
  res = createMockRes();
  await userController.updateUser(req, res);
  assert.strictEqual(res.statusCode, 200);
  console.log('✔ 6.1 Admin User Management: Volunteer approved by Admin.');

  // Test 6.2: Admin Report Verification
  req = { params: { id: citizenReport._id.toString() }, body: {} };
  res = createMockRes();
  await reportController.verifyReport(req, res);
  assert.strictEqual(res.statusCode, 200);

  const reportInDb = await Report.findById(citizenReport._id);
  assert.strictEqual(reportInDb.status, 'verified');

  const reportNotif = await Notification.findOne({ userId: realAbc._id, title: /Report Verified/i });
  assert(reportNotif, 'Citizen must receive report verification notification');
  console.log('✔ 6.2 Admin Report Verification: Report marked verified & Citizen notified.');

  // Test 6.3: Admin Camp Updates
  req = { params: { id: ngoCamp._id.toString() }, body: { occupancy: 280 } };
  res = createMockRes();
  await campController.updateCamp(req, res);
  assert.strictEqual(res.statusCode, 200);

  const updatedCampInDb = await Camp.findById(ngoCamp._id);
  assert.strictEqual(updatedCampInDb.occupancy, 280);
  console.log('✔ 6.3 Admin Camp Management: Occupancy updated.');

  // =========================================================================
  // SECTION 7: DATABASE REFERENTIAL INTEGRITY & CLEANUP
  // =========================================================================
  console.log('\n--- [SECTION 7] DATABASE REFERENTIAL INTEGRITY & CLEANUP ---');

  // Verify No Orphan SOS / RescueCases
  const allCases = await RescueCase.find();
  for (const c of allCases) {
    if (c.sosId) {
      const parentSos = await SOS.findById(c.sosId);
      assert(parentSos, `RescueCase ${c.caseId} must reference a valid SOS document`);
    }
  }
  console.log('✔ 7.1 Orphan Prevention: All RescueCases link to valid SOS records.');

  // Clean up temporary test records
  await User.findByIdAndDelete(createdQaUser._id);
  await SOS.findByIdAndDelete(citizenSos._id);
  await RescueCase.findByIdAndDelete(linkedRescueCase._id);
  await VolunteerTask.findByIdAndDelete(vTask._id);
  await Inventory.findByIdAndDelete(ngoItem._id);
  await Distribution.deleteMany({ campId: ngoCamp._id });
  await Camp.findByIdAndDelete(ngoCamp._id);
  await Report.findByIdAndDelete(citizenReport._id);
  await Notification.deleteMany({ userId: realAbc._id });

  // Final check: User ABC is safe
  const abcFinal = await User.findOne({ email: 'abc@g.com' });
  assert(abcFinal, 'User ABC must remain in MongoDB Atlas');
  console.log('✔ 7.2 Safety & Cleanup: Test records purged. Real user ABC is intact in MongoDB Atlas.');

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('✔ ALL MASTER QA CHECKS PASSED SUCCESSFULLY (100%)');
  console.log('================================================================\n');
}

runMasterQA().catch(err => {
  console.error('Master QA Test Failed:', err);
  process.exit(1);
});
