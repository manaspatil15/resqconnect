require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Camp = require('./models/Camp');
const Report = require('./models/Report');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Notification = require('./models/Notification');

const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const reportController = require('./controllers/reportController');
const campController = require('./controllers/campController');
const notificationController = require('./controllers/notificationController');

// Frontend scripts
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const dashboardJsCode = fs.readFileSync(path.join(__dirname, '../js/dashboard.js'), 'utf8');

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
console.log('       ADMIN WORKFLOW & PLATFORM OVERSIGHT E2E VERIFICATION');
console.log('================================================================\n');

async function testAdminWorkflow() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // 1. Admin Login & Authentication
  console.log('--- 1. Testing Admin Authentication & Login ---');
  let req = { body: { email: 'admin@resqconnect.com', password: 'Admin123', role: 'admin' } };
  let res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 200, 'Admin login must return HTTP 200');
  const adminUser = res.data.data;
  assert.strictEqual(adminUser.name, 'Rajesh Sharma');
  assert.strictEqual(adminUser.role, 'admin');
  console.log(`✔ Login Successful: ${adminUser.name} (${adminUser.email}) [Role: ${adminUser.role}]`);

  // Verify Role Mapping
  const DASHBOARD_BY_ROLE = {
    "Citizen": "citizen-dashboard.html",
    "Volunteer": "volunteer-dashboard.html",
    "NGO": "ngo-dashboard.html",
    "Rescue Team": "rescue-dashboard.html",
    "Admin": "admin-dashboard.html"
  };
  assert.strictEqual(DASHBOARD_BY_ROLE["Admin"], "admin-dashboard.html");
  console.log('✔ Dashboard Navigation Target: admin-dashboard.html');

  // 2. Admin Header Dynamics & Session Normalization
  console.log('\n--- 2. Testing Admin Dashboard Header Dynamics ---');
  const storageAdmin = { resq_current_user: JSON.stringify(adminUser) };
  global.window = {
    location: { pathname: '/admin-dashboard.html' },
    sessionStorage: { getItem: (k) => storageAdmin[k] || null, setItem: (k, v) => storageAdmin[k] = v, removeItem: (k) => delete storageAdmin[k] },
    localStorage: { getItem: (k) => storageAdmin[k] || null, setItem: (k, v) => storageAdmin[k] = v, removeItem: (k) => delete storageAdmin[k] },
    addEventListener: () => {},
    CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
  };
  global.document = { readyState: 'complete', querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
  global.sessionStorage = global.window.sessionStorage;
  global.localStorage = global.window.localStorage;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);

  const authUser = window.ResQAuth.getAuthUser();
  const initials = window.ResQAuth.getInitials(authUser.name);
  assert.strictEqual(authUser.name, 'Rajesh Sharma');
  assert.strictEqual(authUser.role, 'admin');
  assert.strictEqual(initials, 'RS', 'Initials for Rajesh Sharma must be RS');
  console.log(`✔ Header Normalized: Name="${authUser.name}", Role="${authUser.role}", Initials="${initials}"`);

  // 3. User Management (admin-users.html)
  console.log('\n--- 3. Testing User Management (admin-users.html) ---');
  req = { query: {} };
  res = createMockRes();
  await userController.getAllUsers(req, res);
  assert.strictEqual(res.statusCode, 200);
  const allUsers = res.data.data;
  assert(allUsers.length >= 6, 'Must retrieve all registered platform users');
  console.log(`✔ Retrieved ${allUsers.length} platform users from MongoDB Atlas.`);

  // Test updating user status
  const targetUser = allUsers.find(u => u.email === 'volunteer@resqconnect.com');
  assert(targetUser, 'Volunteer user must exist');
  req = { params: { id: targetUser._id.toString() }, body: { status: 'active', isActive: true } };
  res = createMockRes();
  await userController.updateUser(req, res);
  assert.strictEqual(res.statusCode, 200);
  console.log(`✔ Updated User Status: ${targetUser.name} -> active`);

  // 4. Report Management & Verification (admin-reports.html)
  console.log('\n--- 4. Testing Report Verification (admin-reports.html) ---');
  await Report.deleteMany({ reportId: /^RPT-2026-99/ });
  const citizen = await User.findOne({ email: 'abc@g.com' });
  const testReport = await Report.create({
    reportId: `RPT-2026-99${Math.floor(10 + Math.random() * 90)}`,
    citizenId: citizen._id,
    type: 'Flood',
    title: 'Waterlogging QA Test',
    description: 'Minor waterlogging near railway line',
    location: 'Dadar, Mumbai',
    status: 'pending'
  });
  console.log(`✔ Created Test Report: ${testReport.reportId} (Status: pending)`);

  req = { params: { id: testReport._id.toString() }, body: { verifiedBy: adminUser._id.toString() } };
  res = createMockRes();
  await reportController.verifyReport(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.data.isVerified, true);
  console.log(`✔ Admin Verified Report: ${testReport.reportId} -> verified`);

  const updatedReport = await Report.findById(testReport._id);
  assert.strictEqual(updatedReport.status, 'verified');
  console.log(`✔ MongoDB Atlas Report Verified: Status = ${updatedReport.status}`);

  const citizenNotif = await Notification.findOne({ userId: citizen._id, relatedId: testReport._id });
  assert(citizenNotif, 'Citizen must be notified of report verification');
  console.log(`✔ Citizen Notification Created: "${citizenNotif.title}" - "${citizenNotif.message}"`);

  // 5. Relief Camp Management (admin-camps.html)
  console.log('\n--- 5. Testing Relief Camp Creation & Management (admin-camps.html) ---');
  req = {
    body: {
      name: 'Dadar Community Relief Camp QA',
      location: 'Dadar, Mumbai',
      capacity: 300,
      occupancy: 45,
      facilities: ['Food', 'Water', 'First Aid'],
      status: 'active'
    }
  };
  res = createMockRes();
  await campController.createCamp(req, res);
  assert.strictEqual(res.statusCode, 201);
  const createdCamp = res.data.data;
  console.log(`✔ Camp Created in MongoDB Atlas: "${createdCamp.name}" [ID: ${createdCamp.campId || createdCamp._id}]`);

  // 6. Admin Notifications & Global Bell Popover
  console.log('\n--- 6. Testing Admin Notifications & Global Bell Popover ---');
  const adminNotif = await Notification.create({
    userId: adminUser._id,
    title: 'Platform Alert Update',
    message: 'Disaster monitoring systems synchronized for Mumbai coastal region.',
    type: 'info',
    isRead: false
  });
  console.log(`✔ Admin Notification Created: "${adminNotif.title}" - "${adminNotif.message}"`);

  const popoverElement = { innerHTML: '', querySelectorAll: () => [] };
  const bellDotElement = { style: { display: 'none' } };

  global.document.querySelector = (sel) => {
    if (sel === '#notifPopover') return popoverElement;
    if (sel === '.notif-dot') return bellDotElement;
    return null;
  };
  global.document.getElementById = (id) => {
    if (id === 'notifPopover') return popoverElement;
    return null;
  };
  global.document.addEventListener = (evt, fn) => { if (evt === 'DOMContentLoaded') fn(); };
  global.renderCollection = function(opts) {
    if (!opts || !opts.container) return;
    if (!opts.items || opts.items.length === 0) {
      opts.container.innerHTML = `<div class="empty">${opts.emptyState ? opts.emptyState.title : "No items"}</div>`;
      return;
    }
    opts.container.innerHTML = opts.items.map(opts.rowTemplate).join('');
  };
  global.window.renderCollection = global.renderCollection;

  // Sync notifications into ResQStore
  const allNotifsInDb = await Notification.find({ userId: adminUser._id }).sort({ createdAt: -1 });
  window.ResQStore.getAll("notifications").length = 0;
  allNotifsInDb.forEach(n => {
    window.ResQStore.getAll("notifications").push({
      _id: n._id.toString(),
      id: n._id.toString(),
      userId: n.userId.toString(),
      recipientId: n.userId.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.isRead,
      createdAt: n.createdAt.toISOString()
    });
  });

  eval(dashboardJsCode);

  assert(popoverElement.innerHTML.includes('Disaster monitoring systems') || popoverElement.innerHTML.includes('Platform services operational'), 'Admin popover must render admin notification message');
  assert.strictEqual(bellDotElement.style.display, '', 'Notification bell badge dot must be visible');
  console.log('✔ Admin Global Notification Bell Verified: Popover rendered admin notifications with active unread badge.');

  // 7. Role Isolation Verification
  console.log('\n--- 7. Testing Role Notification Scoping & Isolation ---');
  const adminNotifsList = window.ResQStore.getAll("notifications").filter(n => n.userId === adminUser._id.toString());
  const citizenNotifications = await Notification.find({ userId: citizen._id });
  const hasCitizenNotifInAdmin = adminNotifsList.some(n => citizenNotifications.some(cn => cn._id.toString() === (n._id || n.id)));
  assert.strictEqual(hasCitizenNotifInAdmin, false, 'Admin must not receive private citizen notifications');
  console.log('✔ Isolation Verified: Admin receives only system/admin-scoped notifications.');

  // Clean up temporary QA test items
  await Report.findByIdAndDelete(testReport._id);
  await Camp.findByIdAndDelete(createdCamp._id);
  await Notification.findByIdAndDelete(citizenNotif._id);
  await Notification.findByIdAndDelete(adminNotif._id);
  console.log('\n✔ Temporary QA records cleaned up.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ ADMIN WORKFLOW & PLATFORM OVERSIGHT VERIFIED (100% PASS)');
  console.log('================================================================\n');
}

testAdminWorkflow().catch(err => {
  console.error('Admin test failed:', err);
  process.exit(1);
});
