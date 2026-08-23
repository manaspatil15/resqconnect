require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Camp = require('./models/Camp');
const Notification = require('./models/Notification');
const inventoryController = require('./controllers/inventoryController');
const distributionController = require('./controllers/distributionController');

console.log('=== STARTING NGO INVENTORY & DISTRIBUTION WORKFLOW TESTS ===\n');

// Load frontend scripts into mock DOM environment for frontend assertion
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // 1. Verify User ABC Exists & Test NGO Header Dynamics
  const citizenUser = await User.findOne({ email: 'abc@g.com' });
  assert(citizenUser, 'Citizen user abc@g.com must exist in database');
  console.log(`✔ Real User Account Verified: ${citizenUser.name} (${citizenUser.email})`);

  const ngoUser = {
    _id: "6a8ae7777777777777777777",
    name: "Priya Nair",
    email: "priya.nair@sahayata.org",
    role: "ngo",
    phone: "9876543212"
  };

  const storage = { resq_current_user: JSON.stringify(ngoUser) };
  global.window = {
    location: { pathname: "/ngo-dashboard.html" },
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
  assert.strictEqual(authUser.name, "Priya Nair", "NGO user name must normalize to Priya Nair");
  assert.strictEqual(authUser.role, "ngo", "NGO user role must normalize to ngo");
  
  const initials = window.ResQAuth.getInitials(authUser.name);
  assert.strictEqual(initials, "PN", "Initials for 'Priya Nair' must be 'PN'");
  console.log(`✔ NGO Header Dynamics: Name='${authUser.name}', Role='${authUser.role}', Initials='${initials}'`);

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

  // 2. Test Relief Camp Creation
  console.log('\n--- 1. Setting up Relief Camp ---');
  let testCamp = await Camp.findOne({ name: "Kurla Relief Center" });
  if (!testCamp) {
    testCamp = await Camp.create({
      name: "Kurla Relief Center",
      location: "Kurla West, Mumbai",
      capacity: 600,
      occupancy: 120,
      status: "active"
    });
  }
  console.log(`✔ Relief Camp Verified: ${testCamp.name} (ID: ${testCamp._id})`);

  // 3. Create NGO Inventory Item: Quantity = 100
  console.log('\n--- 2. Creating Inventory Item (Quantity = 100) ---');
  let req = {
    body: {
      name: "Emergency Ration Kits",
      category: "Food & Ration",
      quantity: 100,
      capacity: 100,
      unit: "kits",
      lowStockThreshold: 40,
      ngoId: ngoUser._id
    }
  };
  let res = createMockRes();

  await inventoryController.createInventory(req, res);
  assert.strictEqual(res.statusCode, 201, "Inventory creation should return HTTP 201");
  const createdInv = res.data.data;
  console.log(`✔ Inventory Created: ${createdInv.itemId} - ${createdInv.name} (Qty: ${createdInv.quantity} ${createdInv.unit})`);

  // Verify MongoDB Atlas state
  const invFromDb = await Inventory.findById(createdInv._id);
  assert.strictEqual(invFromDb.quantity, 100, "Initial inventory in DB must be exactly 100");

  const notifInv = await Notification.findOne({ userId: ngoUser._id, relatedId: createdInv._id, title: /Inventory Stock Added/i });
  assert(notifInv, "Notification should be generated for NGO on inventory creation");
  console.log(`✔ Notification Generated: "${notifInv.title}" - "${notifInv.message}"`);

  // 4. Test Over-Stock Rejection: Attempt to distribute 150 units (Stock is 100)
  console.log('\n--- 3. Testing Over-Stock Distribution Rejection (Request: 150 > Stock: 100) ---');
  req = {
    body: {
      ngoId: ngoUser._id,
      campId: testCamp._id.toString(),
      inventoryId: createdInv._id.toString(),
      quantity: 150
    }
  };
  res = createMockRes();

  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 400, "Over-stock distribution must return HTTP 400");
  assert(/Not enough stock/i.test(res.data.message), "Error message must state not enough stock");
  console.log(`✔ Over-Stock Correctly Blocked: "${res.data.message}"`);

  const invAfterRejection = await Inventory.findById(createdInv._id);
  assert.strictEqual(invAfterRejection.quantity, 100, "Inventory stock must remain 100 after rejected attempt");

  // 5. Test Valid Distribution: Distribute 30 units (100 -> 70)
  console.log('\n--- 4. Testing Valid Distribution (100 - 30 = 70) ---');
  req = {
    body: {
      ngoId: ngoUser._id,
      campId: testCamp._id.toString(),
      inventoryId: createdInv._id.toString(),
      quantity: 30,
      notes: "First relief drop"
    }
  };
  res = createMockRes();

  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201, "Valid distribution must return HTTP 201");
  const createdDist1 = res.data.data;
  console.log(`✔ Distribution Logged: ${createdDist1.distributionId} (Qty: ${createdDist1.quantity})`);

  // Verify stock decrement in MongoDB Atlas
  const invAfterDist1 = await Inventory.findById(createdInv._id);
  assert.strictEqual(invAfterDist1.quantity, 70, "Inventory stock in DB must be exactly 70");
  console.log(`✔ Verified MongoDB Atlas Stock Decrement: 100 -> 70 ${invAfterDist1.unit}`);

  const notifDist1 = await Notification.findOne({ userId: ngoUser._id, relatedId: createdDist1._id, title: /Distribution Logged/i });
  assert(notifDist1, "Notification should be generated for NGO on distribution log");
  console.log(`✔ Notification Generated: "${notifDist1.title}" - "${notifDist1.message}"`);

  // 6. Test Low Stock Threshold Trigger: Distribute 35 units (70 -> 35 <= threshold 40)
  console.log('\n--- 5. Testing Low-Stock Warning (70 - 35 = 35 <= 40 threshold) ---');
  req = {
    body: {
      ngoId: ngoUser._id,
      campId: testCamp._id.toString(),
      inventoryId: createdInv._id.toString(),
      quantity: 35,
      notes: "Second relief drop"
    }
  };
  res = createMockRes();

  await distributionController.logDistribution(req, res);
  assert.strictEqual(res.statusCode, 201, "Valid distribution must return HTTP 201");
  const createdDist2 = res.data.data;

  const invAfterDist2 = await Inventory.findById(createdInv._id);
  assert.strictEqual(invAfterDist2.quantity, 35, "Inventory stock in DB must be exactly 35");
  console.log(`✔ Verified MongoDB Atlas Stock Decrement: 70 -> 35 ${invAfterDist2.unit}`);

  const notifLowStock = await Notification.findOne({ userId: ngoUser._id, relatedId: createdInv._id, title: /Low Stock Alert/i });
  assert(notifLowStock, "Low stock notification should be generated when stock drops to or below threshold");
  console.log(`✔ Low Stock Warning Generated: "${notifLowStock.title}" - "${notifLowStock.message}"`);

  // 7. Cleanup Temporary Test Records
  console.log('\n--- Cleaning up temporary test records ---');
  await Inventory.findByIdAndDelete(createdInv._id);
  await Distribution.findByIdAndDelete(createdDist1._id);
  await Distribution.findByIdAndDelete(createdDist2._id);
  await Notification.deleteMany({ userId: ngoUser._id });
  if (testCamp.name === "Kurla Relief Center") {
    await Camp.findByIdAndDelete(testCamp._id);
  }
  console.log('✔ Temporary test records cleaned up. Real user accounts remain intact.');

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ ALL NGO INVENTORY & DISTRIBUTION CHECKS PASSED (100%)');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
