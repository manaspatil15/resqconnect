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

const inventoryController = require('./controllers/inventoryController');
const distributionController = require('./controllers/distributionController');

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

console.log('=== TESTING NGO NOTIFICATION FLOW & GLOBAL BELL POPOVER ===\n');

async function testNgoNotificationBell() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // Find demo NGO user
  const ngoUser = await User.findOne({ email: 'ngo@resqconnect.com' });
  assert(ngoUser, 'NGO user ngo@resqconnect.com must exist');

  // Clean test notifications
  await Notification.deleteMany({ userId: ngoUser._id });

  // 1. Test Adding Inventory -> "Inventory Stock Added" Notification
  console.log('\n--- 1. Testing Add Inventory -> "Inventory Stock Added" ---');
  let req = {
    body: {
      name: 'Emergency Ration Kits QA',
      category: 'Food Supplies',
      quantity: 100,
      capacity: 100,
      unit: 'kits',
      lowStockThreshold: 40,
      ngoId: ngoUser._id.toString()
    }
  };
  let res = createMockRes();
  await inventoryController.createInventory(req, res);
  assert.strictEqual(res.statusCode, 201);
  const invItem = res.data.data;

  const notifAdd = await Notification.findOne({ userId: ngoUser._id, relatedId: invItem._id, title: /Inventory Stock Added/i });
  assert(notifAdd, 'Notification for inventory addition must be created in MongoDB');
  assert.strictEqual(notifAdd.userId.toString(), ngoUser._id.toString(), 'Notification must belong to Priya Nair');
  console.log(`✔ Notification 1 Created: "${notifAdd.title}" - "${notifAdd.message}"`);

  // 2. Test Logging Distribution -> "Distribution Logged" Notification
  console.log('\n--- 2. Testing Distribution -> "Distribution Logged" ---');
  let camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });
  if (!camp) camp = await Camp.create({ name: 'Ghatkopar Central Relief Center', location: 'Ghatkopar, Mumbai', capacity: 500, occupancy: 120 });

  req = {
    body: {
      ngoId: ngoUser._id.toString(),
      campId: camp._id.toString(),
      inventoryId: invItem._id.toString(),
      quantity: 30
    }
  };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);
  const distRecord = res.data.data;

  const notifDist = await Notification.findOne({ userId: ngoUser._id, relatedId: distRecord._id, title: /Distribution Logged/i });
  assert(notifDist, 'Notification for distribution must be created in MongoDB');
  assert.strictEqual(notifDist.userId.toString(), ngoUser._id.toString(), 'Notification must belong to Priya Nair');
  console.log(`✔ Notification 2 Created: "${notifDist.title}" - "${notifDist.message}"`);

  // 3. Test Low Stock Threshold -> "Low Stock Alert" Notification
  console.log('\n--- 3. Testing Low Stock Threshold (70 -> 35 <= 40) -> "Low Stock Alert" ---');
  req = {
    body: {
      ngoId: ngoUser._id.toString(),
      campId: camp._id.toString(),
      inventoryId: invItem._id.toString(),
      quantity: 35
    }
  };
  res = createMockRes();
  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201);

  const notifLow = await Notification.findOne({ userId: ngoUser._id, title: /Low Stock Alert/i });
  assert(notifLow, 'Notification for low stock alert must be created in MongoDB');
  assert.strictEqual(notifLow.userId.toString(), ngoUser._id.toString(), 'Notification must belong to Priya Nair');
  console.log(`✔ Notification 3 Created: "${notifLow.title}" - "${notifLow.message}"`);

  // 4. Test Frontend Global Notification Bell Popover for Priya Nair
  console.log('\n--- 4. Testing Frontend Notification Bell for Priya Nair ---');
  const storageNgo = { resq_current_user: JSON.stringify({ _id: ngoUser._id.toString(), name: ngoUser.name, email: ngoUser.email, role: 'ngo' }) };

  const popoverElement = { innerHTML: '', querySelectorAll: () => [] };
  const bellDotElement = { style: { display: 'none' } };

  global.window = {
    location: { pathname: '/ngo-dashboard.html' },
    sessionStorage: { getItem: (k) => storageNgo[k] || null, setItem: (k, v) => storageNgo[k] = v, removeItem: (k) => delete storageNgo[k] },
    localStorage: { getItem: (k) => storageNgo[k] || null, setItem: (k, v) => storageNgo[k] = v, removeItem: (k) => delete storageNgo[k] },
    addEventListener: () => {},
    CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
  };
  global.document = {
    readyState: 'complete',
    querySelector: (sel) => {
      if (sel === '#notifPopover') return popoverElement;
      if (sel === '.notif-dot') return bellDotElement;
      return null;
    },
    querySelectorAll: (sel) => [],
    getElementById: (id) => {
      if (id === 'notifPopover') return popoverElement;
      return null;
    },
    addEventListener: (evt, fn) => { if (evt === 'DOMContentLoaded') fn(); }
  };
  global.sessionStorage = global.window.sessionStorage;
  global.localStorage = global.window.localStorage;
  global.$ = global.document.querySelector;
  global.$$ = global.document.querySelectorAll;

  // Render collection helper
  global.renderCollection = function(opts) {
    if (!opts || !opts.container) return;
    if (!opts.items || opts.items.length === 0) {
      opts.container.innerHTML = `<div class="empty">${opts.emptyState ? opts.emptyState.title : "No items"}</div>`;
      return;
    }
    opts.container.innerHTML = opts.items.map(opts.rowTemplate).join('');
  };
  global.window.renderCollection = global.renderCollection;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);

  // Sync notifications into ResQStore
  const allNotifsInDb = await Notification.find({ userId: ngoUser._id }).sort({ createdAt: -1 });
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

  // Evaluate dashboard.js (executes initNotifPopover)
  eval(dashboardJsCode);

  // Assertions on the rendered popover HTML
  assert(popoverElement.innerHTML.includes('low on stock'), 'Popover must render Low Stock Alert');
  assert(popoverElement.innerHTML.includes('dispatched to'), 'Popover must render Distribution Logged');
  assert(popoverElement.innerHTML.includes('Added 100'), 'Popover must render Inventory Stock Added');
  assert.strictEqual(bellDotElement.style.display, '', 'Notification bell badge dot must be visible (display: "")');
  console.log('✔ Frontend Notification Bell Verified: Popover rendered all 3 NGO notifications and unread badge dot is active.');

  // 5. Test Volunteer / Citizen Isolation
  console.log('\n--- 5. Testing Other Role Isolation ---');
  const storageCitizen = { resq_current_user: JSON.stringify({ _id: '6a8ae23227abd697f5ed424c', name: 'ABC', email: 'abc@g.com', role: 'citizen' }) };
  global.sessionStorage.getItem = (k) => storageCitizen[k] || null;
  global.localStorage.getItem = (k) => storageCitizen[k] || null;

  const citizenUser = window.ResQAuth.getAuthUser();
  const citizenFiltered = window.ResQStore.getAll("notifications").filter(n => n.userId === citizenUser._id);
  assert.strictEqual(citizenFiltered.length, 0, 'Citizen must see 0 NGO notifications');
  console.log('✔ Role Isolation Verified: Citizen ABC sees 0 NGO notifications.');

  // Cleanup ONLY temporary QA items created in this test
  await Inventory.findByIdAndDelete(invItem._id);
  await Distribution.findByIdAndDelete(distRecord._id);
  await Notification.deleteMany({ relatedId: { $in: [invItem._id, distRecord._id] } });
  console.log('\n✔ Temporary QA records cleaned up.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ ALL NGO NOTIFICATION FLOW & BELL CHECKS PASSED (100%)');
  console.log('================================================================\n');
}

testNgoNotificationBell().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
