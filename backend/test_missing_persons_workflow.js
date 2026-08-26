require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Report = require('./models/Report');
const Notification = require('./models/Notification');
const reportController = require('./controllers/reportController');

console.log('================================================================');
console.log('    RESQCONNECT MISSING PERSONS FULL-SYSTEM VERIFICATION TEST   ');
console.log('================================================================\n');

// Mock DOM / browser environment for frontend store and runtime verification
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

function setupMockDom(currentUser = null) {
  const storage = {};
  if (currentUser) {
    storage.resq_current_user = JSON.stringify(currentUser);
    storage.user = JSON.stringify(currentUser);
  }

  global.window = {
    location: { pathname: "/citizen-missing.html" },
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
      readyState: "complete",
      addEventListener: () => {},
      dispatchEvent: () => {},
      documentElement: { setAttribute: () => {}, removeAttribute: () => {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null
    }
  };
  global.document = global.window.document;
  global.sessionStorage = global.window.sessionStorage;
  global.localStorage = global.window.localStorage;
  global.CustomEvent = global.window.CustomEvent;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runMissingPersonsTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  const createdIds = {
    users: [],
    reports: [],
    notifications: []
  };

  try {
    // --- 0. Setup Test Roles in MongoDB ---
    const timestamp = Date.now();
    const citizenUser = await User.create({
      name: "Test Citizen Reporter",
      email: `citizen_${timestamp}@test.com`,
      password: "password123",
      role: "citizen",
      phone: "+91 9876543210",
      isActive: true
    });
    createdIds.users.push(citizenUser._id);

    const otherCitizen = await User.create({
      name: "Other Citizen Viewer",
      email: `other_citizen_${timestamp}@test.com`,
      password: "password123",
      role: "citizen",
      phone: "+91 9876500000",
      isActive: true
    });
    createdIds.users.push(otherCitizen._id);

    const adminUser = await User.create({
      name: "Admin Officer",
      email: `admin_${timestamp}@test.com`,
      password: "password123",
      role: "admin",
      phone: "+91 9876511111",
      isActive: true
    });
    createdIds.users.push(adminUser._id);

    const volunteerUser = await User.create({
      name: "Rescue Volunteer",
      email: `volunteer_${timestamp}@test.com`,
      password: "password123",
      role: "volunteer",
      phone: "+91 9876522222",
      isActive: true
    });
    createdIds.users.push(volunteerUser._id);

    const rescueUser = await User.create({
      name: "NDRF Rescue Lead",
      email: `rescue_${timestamp}@test.com`,
      password: "password123",
      role: "rescue",
      phone: "+91 9876533333",
      isActive: true
    });
    createdIds.users.push(rescueUser._id);

    const ngoUser = await User.create({
      name: "Sahayata NGO Rep",
      email: `ngo_${timestamp}@test.com`,
      password: "password123",
      role: "ngo",
      phone: "+91 9876544444",
      isActive: true
    });
    createdIds.users.push(ngoUser._id);

    console.log('✔ Test users initialized across 5 roles (Citizen, Admin, Volunteer, Rescue, NGO).\n');

    // --- TEST 1: Citizen creates missing-person report ---
    console.log('--- [TEST 1 & 2] Citizen Submission & MongoDB Atlas Persistence ---');
    let req = {
      body: {
        personName: "Aarav Sharma",
        age: 12,
        gender: "Male",
        lastSeenLocation: "Andheri West, Near Metro Station",
        lastSeenAt: new Date().toISOString(),
        description: "Wearing a green t-shirt and blue jeans. Has a small birthmark on left arm.",
        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        citizenId: citizenUser._id.toString(),
        contactName: citizenUser.name,
        contactPhone: citizenUser.phone
      }
    };
    let res = createMockRes();
    await reportController.createMissingPersonReport(req, res);

    assert.strictEqual(res.statusCode, 201, "Missing person creation should return HTTP 201");
    assert(res.data.success, "Response should indicate success");
    const createdReportData = res.data.data;
    assert(createdReportData._id || createdReportData.id, "Report should have MongoDB _id");
    assert(createdReportData.reportId && createdReportData.reportId.startsWith("MP-"), "Report ID should start with 'MP-'");
    createdIds.reports.push(createdReportData._id);

    console.log(`✔ Report Created with Authoritative Case ID: ${createdReportData.reportId}`);

    // Verify directly in MongoDB
    const reportInDb = await Report.findById(createdReportData._id);
    assert(reportInDb, "Report document must exist in MongoDB Atlas");
    assert.strictEqual(reportInDb.personName, "Aarav Sharma", "personName must match in MongoDB");
    assert.strictEqual(reportInDb.age, 12, "Age must match in MongoDB");
    assert.strictEqual(reportInDb.gender, "Male", "Gender must match in MongoDB");
    assert.strictEqual(reportInDb.status, "reported", "Default status must be 'reported'");
    assert.strictEqual(reportInDb.type, "Missing Person", "Type must be 'Missing Person'");
    console.log(`✔ Direct MongoDB Verification: Document confirmed in Atlas (Status: '${reportInDb.status}', Type: '${reportInDb.type}').\n`);

    // --- TEST 3: Report retrieval after page refresh / re-login ---
    console.log('--- [TEST 3] Persistence & Re-Login Retrieval Simulation ---');
    setupMockDom(citizenUser);
    const storeRecord = window.ResQStore.normalizeItem("missingPersons", reportInDb.toObject());
    assert.strictEqual(storeRecord.name, "Aarav Sharma", "Store normalized name must match");
    assert.strictEqual(storeRecord.id, reportInDb.reportId, "Store normalized id must match reportId");
    console.log(`✔ Frontend store correctly normalized record for Case ID: ${storeRecord.id}`);

    // --- TEST 4: Admin sees all reports with full reporter details ---
    console.log('--- [TEST 4] Admin Management & Full Visibility ---');
    req = { query: { role: "admin", userId: adminUser._id.toString() } };
    res = createMockRes();
    await reportController.getAllMissingPersons(req, res);

    assert.strictEqual(res.statusCode, 200, "Admin query should return HTTP 200");
    const adminReport = res.data.data.find((r) => r.reportId === createdReportData.reportId || r.id === createdReportData.reportId);
    assert(adminReport, "Admin must find the created missing person report");
    assert.strictEqual(adminReport.contactPhone, "+91 9876543210", "Admin must have access to real reporter contact phone");
    assert(adminReport.citizenId && adminReport.citizenId.email, "Admin must have access to reporter email");
    console.log(`✔ Admin Visibility Confirmed: Complete case details & reporter contact (${adminReport.contactPhone}) accessible.\n`);

    // --- TEST 5: Admin can update status ---
    console.log('--- [TEST 5] Status Transition: Reported -> Investigating ---');
    req = {
      params: { id: reportInDb._id.toString() },
      body: { status: "investigating" }
    };
    res = createMockRes();
    await reportController.updateReportStatus(req, res);
    assert.strictEqual(res.statusCode, 200, "Status update should return HTTP 200");

    const updatedInDb = await Report.findById(reportInDb._id);
    assert.strictEqual(updatedInDb.status, "investigating", "Database status must be updated to 'investigating'");
    console.log(`✔ Status update verified in DB: ${updatedInDb.reportId} is now '${updatedInDb.status}'.\n`);

    // --- TEST 6 & 7: Volunteer & Rescue receive appropriate notifications ---
    console.log('--- [TEST 6 & 7] Multi-Role Responder Notifications ---');
    const volunteerNotif = await Notification.findOne({
      userId: volunteerUser._id,
      title: /Missing Person Alert/i
    });
    assert(volunteerNotif, "Volunteer must receive missing person broadcast notification");
    console.log(`✔ Volunteer Notification Confirmed: "${volunteerNotif.title}" - "${volunteerNotif.message}"`);

    const rescueNotif = await Notification.findOne({
      userId: rescueUser._id,
      title: /Missing Person Alert/i
    });
    assert(rescueNotif, "Rescue lead must receive missing person broadcast notification");
    console.log(`✔ Rescue Lead Notification Confirmed: "${rescueNotif.title}" - "${rescueNotif.message}"`);

    const ngoNotif = await Notification.findOne({
      userId: ngoUser._id,
      title: /Missing Person Alert/i
    });
    assert(ngoNotif, "NGO must receive missing person broadcast notification");
    console.log(`✔ NGO Notification Confirmed: "${ngoNotif.title}" - "${ngoNotif.message}"\n`);

    // --- TEST 8 & 9: Privacy Scoping & Information Masking for Non-Admins ---
    console.log('--- [TEST 8 & 9] Role-Based Privacy & Contact Sanitization ---');
    // Volunteer Query
    req = { query: { role: "volunteer", userId: volunteerUser._id.toString() } };
    res = createMockRes();
    await reportController.getAllMissingPersons(req, res);
    const volunteerReport = res.data.data.find((r) => r.reportId === createdReportData.reportId || r.id === createdReportData.reportId);
    assert(volunteerReport, "Volunteer must see the operational case");
    assert.strictEqual(volunteerReport.contactPhone, "[Confidential]", "Volunteer must NOT see private reporter phone");
    assert(!volunteerReport.citizenId || !volunteerReport.citizenId.phone, "Volunteer must NOT see populated citizen phone");
    console.log(`✔ Volunteer Privacy Check: Case operational info visible, Reporter phone masked as '${volunteerReport.contactPhone}'.`);

    // Other Citizen (Public) Query
    req = { query: { role: "citizen", userId: otherCitizen._id.toString() } };
    res = createMockRes();
    await reportController.getAllMissingPersons(req, res);
    const publicReport = res.data.data.find((r) => r.reportId === createdReportData.reportId || r.id === createdReportData.reportId);
    assert(publicReport, "Public citizen must see active search case");
    assert.strictEqual(publicReport.contactPhone, "[Confidential]", "Public citizen must NOT see private phone of reporter");
    console.log(`✔ Public Citizen Privacy Check: Reporter contact masked securely for third-party citizens.\n`);

    // --- TEST 10: Marking Person as Found propagates correctly ---
    console.log('--- [TEST 10] Marking Person as Found & Resolution Notifications ---');
    req = {
      params: { id: reportInDb._id.toString() },
      body: {}
    };
    res = createMockRes();
    await reportController.markPersonFound(req, res);
    assert.strictEqual(res.statusCode, 200, "Mark found should return HTTP 200");

    const foundInDb = await Report.findById(reportInDb._id);
    assert.strictEqual(foundInDb.status, "found", "Database status must be 'found'");
    console.log(`✔ Case Marked as Found: ${foundInDb.reportId} status in MongoDB is 'found'.`);

    const citizenFoundNotif = await Notification.findOne({
      userId: citizenUser._id,
      title: /Missing Person Found Safe/i
    });
    assert(citizenFoundNotif, "Reporting citizen must receive 'Found Safe' notification");
    console.log(`✔ Citizen Resolution Notification Confirmed: "${citizenFoundNotif.title}" - "${citizenFoundNotif.message}"`);

    const adminResolutionNotif = await Notification.findOne({
      userId: adminUser._id,
      title: /Missing Person Resolved/i
    });
    assert(adminResolutionNotif, "Admin must receive case resolution notification");
    console.log(`✔ Admin Resolution Broadcast Confirmed: "${adminResolutionNotif.title}" - "${adminResolutionNotif.message}"\n`);

    // --- TEST 11: Existing General Disaster Reports Unaffected ---
    console.log('--- [TEST 11] Disaster Report Regression Verification ---');
    req = {
      body: {
        citizenId: citizenUser._id.toString(),
        type: "Flood",
        title: "Severe Road Inundation",
        location: "Kurla Station Road",
        description: "Water levels at 2.5 feet near railway underpass"
      }
    };
    res = createMockRes();
    await reportController.createReport(req, res);
    assert.strictEqual(res.statusCode, 201, "Disaster report creation should return HTTP 201");
    const disasterReport = res.data.data;
    assert(disasterReport.reportId.startsWith("RPT-"), "Disaster reports must retain 'RPT-' prefix");
    createdIds.reports.push(disasterReport._id);
    console.log(`✔ Disaster report workflow intact: Created ${disasterReport.reportId} (Status: '${disasterReport.status}').\n`);

    // --- TEST 12: Admin Verification of Disaster Report Continues Working ---
    console.log('--- [TEST 12] Admin Verification Regression Check ---');
    req = {
      params: { id: disasterReport._id.toString() },
      body: { verifiedBy: adminUser._id.toString() }
    };
    res = createMockRes();
    await reportController.verifyReport(req, res);
    assert.strictEqual(res.statusCode, 200, "Disaster report verification must return HTTP 200");
    const verifiedDisaster = await Report.findById(disasterReport._id);
    assert.strictEqual(verifiedDisaster.status, "verified", "Disaster report status must be 'verified'");
    console.log(`✔ Admin verification of disaster report intact: ${verifiedDisaster.reportId} verified successfully.\n`);

  } finally {
    // Cleanup temporary test data
    console.log('--- Cleanup Temporary Test Records ---');
    if (createdIds.reports.length) {
      await Report.deleteMany({ _id: { $in: createdIds.reports } });
    }
    if (createdIds.users.length) {
      await User.deleteMany({ _id: { $in: createdIds.users } });
      await Notification.deleteMany({ userId: { $in: createdIds.users } });
    }
    console.log('✔ All temporary test documents purged from MongoDB Atlas.');
  }

  console.log('\n================================================================');
  console.log('✔ ALL 12 MISSING-PERSON WORKFLOW & REGRESSION CHECKS PASSED (100%)');
  console.log('================================================================\n');
}

runMissingPersonsTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Failed:', err);
    process.exit(1);
  });
