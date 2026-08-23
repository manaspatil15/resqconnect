require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Camp = require('./models/Camp');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Notification = require('./models/Notification');

const authController = require('./controllers/authController');
const inventoryController = require('./controllers/inventoryController');
const distributionController = require('./controllers/distributionController');
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
console.log('       NGO RELIEF OPERATIONS COMPLETE E2E VERIFICATION');
console.log('================================================================\n');

async function testNgoWorkflow() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // 1. NGO Login & Authentication
  console.log('--- 1. Testing NGO Authentication & Login ---');
  let req = { body: { email: 'ngo@resqconnect.com', password: 'Ngo12345', role: 'ngo' } };
  let res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 200, 'NGO login must return HTTP 200');
  const ngoUser = res.data.data;
  assert.strictEqual(ngoUser.name, 'Priya Nair');
  assert.strictEqual(ngoUser.role, 'ngo');
  console.log(`✔ Login Successful: ${ngoUser.name} (${ngoUser.email}) [Role: ${ngoUser.role}]`);

  // Verify Role Mapping
  const DASHBOARD_BY_ROLE = {
    "Citizen": "citizen-dashboard.html",
    "Volunteer": "volunteer-dashboard.html",
    "NGO": "ngo-dashboard.html",
    "Rescue Team": "rescue-dashboard.html",
    "Admin": "admin-dashboard.html"
  };
  assert.strictEqual(DASHBOARD_BY_ROLE["NGO"], "ngo-dashboard.html");
  console.log('✔ Dashboard Navigation Target: ngo-dashboard.html');

  // 2. NGO Header Dynamics & Session Normalization
  console.log('\n--- 2. Testing NGO Dashboard Header Dynamics ---');
  const storageNgo = { resq_current_user: JSON.stringify(ngoUser) };
  global.window = {
    location: { pathname: '/ngo-dashboard.html' },
    sessionStorage: { getItem: (k) => storageNgo[k] || null, setItem: (k, v) => storageNgo[k] = v, removeItem: (k) => delete storageNgo[k] },
    localStorage: { getItem: (k) => storageNgo[k] || null, setItem: (k, v) => storageNgo[k] = v, removeItem: (k) => delete storageNgo[k] },
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
  assert.strictEqual(authUser.name, 'Priya Nair');
  assert.strictEqual(authUser.role, 'ngo');
  assert.strictEqual(initials, 'PN', 'Initials for Priya Nair must be PN');
  console.log(`✔ Header Normalized: Name="${authUser.name}", Role="${authUser.role}", Initials="${initials}"`);

  // 3. Add Inventory Item (ngo-inventory.html)
  console.log('\n--- 3. Testing Add Inventory Item (ngo-inventory.html) ---');
  req = {
    body: {
      name: 'Drinking Water 20L Cans',
      category: 'Water Supply',
      quantity: 100,
      capacity: 100,
      unit: 'cans',
      lowStockThreshold: 40,
      ngoId: ngoUser._id
    }
  };
  res = createMockRes();
  await inventoryController.createInventory(req, res);
  assert.strictEqual(res.statusCode, 201);
  const createdInv = res.data.data;
  assert.strictEqual(createdInv.name, 'Drinking Water 20L Cans');
  assert.strictEqual(createdInv.quantity, 100);
  console.log(`✔ Inventory Item Created: ${createdInv.itemId} - "${createdInv.name}" (Qty: ${createdInv.quantity} ${createdInv.unit})`);

  const notifAdd = await Notification.findOne({ userId: ngoUser._id, relatedId: createdInv._id, title: /Inventory Stock Added/i });
  assert(notifAdd, 'Notification for inventory stock addition must be generated');
  console.log(`✔ Notification Generated: "${notifAdd.title}" - "${notifAdd.message}"`);

  // 4. Test Over-Stock Distribution Blocking
  console.log('\n--- 4. Testing Over-Stock Distribution Rejection ---');
  let camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });
  if (!camp) {
    camp = await Camp.create({ name: 'Ghatkopar Central Relief Center', location: 'Ghatkopar, Mumbai', capacity: 500, occupancy: 120 });
  }

  req = {
    body: {
      ngoId: ngoUser._id,
      campId: camp._id,
      inventoryId: createdInv._id,
      quantity: 150 // > 100 available
    }
  };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 400, 'Over-stock distribution must return HTTP 400');
  console.log(`✔ Over-Stock Blocked: "${res.data.message}"`);

  // 5. Test Valid Distribution (100 -> 70)
  console.log('\n--- 5. Testing Valid Distribution (100 -> 70 cans) ---');
  req = {
    body: {
      ngoId: ngoUser._id,
      campId: camp._id,
      inventoryId: createdInv._id,
      quantity: 30
    }
  };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);
  const distRecord = res.data.data;
  console.log(`✔ Distribution Logged: ${distRecord.distributionId} - 30 cans dispatched to ${camp.name}`);

  const updatedInv1 = await Inventory.findById(createdInv._id);
  assert.strictEqual(updatedInv1.quantity, 70, 'Inventory quantity must decrement from 100 to 70');
  console.log(`✔ MongoDB Atlas Stock Verified: Decremented 100 -> ${updatedInv1.quantity} cans.`);

  const notifDist = await Notification.findOne({ userId: ngoUser._id, relatedId: distRecord._id, title: /Distribution Logged/i });
  assert(notifDist, 'Notification for logged distribution must be generated');
  console.log(`✔ Notification Generated: "${notifDist.title}" - "${notifDist.message}"`);

  // 6. Test Low Stock Warning (70 -> 35 <= 40 threshold)
  console.log('\n--- 6. Testing Low Stock Alert Trigger (70 -> 35 <= 40 cans) ---');
  req = {
    body: {
      ngoId: ngoUser._id,
      campId: camp._id,
      inventoryId: createdInv._id,
      quantity: 35
    }
  };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);

  const updatedInv2 = await Inventory.findById(createdInv._id);
  assert.strictEqual(updatedInv2.quantity, 35, 'Inventory quantity must decrement from 70 to 35');
  console.log(`✔ MongoDB Atlas Stock Verified: Decremented 70 -> ${updatedInv2.quantity} cans.`);

  const notifLow = await Notification.findOne({ userId: ngoUser._id, title: /Low Stock Alert/i });
  assert(notifLow, 'Low Stock Alert notification must be generated when stock <= threshold');
  console.log(`✔ Notification Generated: "${notifLow.title}" - "${notifLow.message}"`);

  // 7. Test NGO Notifications Scoping
  console.log('\n--- 7. Testing NGO Notifications Scoping ---');
  req = { query: { userId: ngoUser._id.toString() } };
  res = createMockRes();
  await notificationController.getNotifications(req, res);
  assert.strictEqual(res.statusCode, 200);
  const ngoNotifs = res.data.data;
  assert(ngoNotifs.length >= 3, 'NGO must have received at least 3 notifications');
  console.log(`✔ NGO Notifications Verified: ${ngoNotifs.length} notifications:`);
  ngoNotifs.forEach(n => console.log(`   • [${n.type}] ${n.title}: "${n.message}"`));

  // Clean up temporary test inventory & distribution records
  await Inventory.findByIdAndDelete(createdInv._id);
  await Distribution.findByIdAndDelete(distRecord._id);
  await Notification.deleteMany({ relatedId: { $in: [createdInv._id, distRecord._id] } });
  console.log('\n✔ Test inventory and distribution records cleaned up.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ NGO RELIEF OPERATIONS WORKFLOW VERIFIED (100% PASS)');
  console.log('================================================================\n');
}

testNgoWorkflow().catch(err => {
  console.error('NGO workflow test failed:', err);
  process.exit(1);
});
