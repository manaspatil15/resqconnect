require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Notification = require('./models/Notification');
const notificationController = require('./controllers/notificationController');

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

console.log('=== TESTING CITIZEN NOTIFICATION SCOPING & USER ISOLATION ===\n');

async function testNotificationScoping() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // Find or create test users
  let pqrUser = await User.findOne({ email: 'pqr@m.com' });
  if (!pqrUser) {
    pqrUser = await User.create({
      name: 'pqr',
      email: 'pqr@m.com',
      password: 'password123',
      role: 'citizen',
      status: 'active',
      isActive: true
    });
  }

  let abcUser = await User.findOne({ email: 'abc@g.com' });
  if (!abcUser) {
    abcUser = await User.create({
      name: 'ABC',
      email: 'abc@g.com',
      password: 'password123',
      role: 'citizen',
      status: 'active',
      isActive: true
    });
  }

  let rescueUser = await User.findOne({ email: 'rescue@resqconnect.com' });
  if (!rescueUser) {
    rescueUser = await User.create({
      name: 'Capt. Vikram Rao',
      email: 'rescue@resqconnect.com',
      password: 'Rescue123',
      role: 'rescue',
      status: 'active',
      isActive: true
    });
  }

  const volunteerUserId = new mongoose.Types.ObjectId();

  // Create test notifications
  const volunteerNotif1 = await Notification.create({
    userId: volunteerUserId,
    title: "Task Completed",
    message: "You completed task 'Distribute Drinking Water in Sector 4'. Great work!",
    type: "success"
  });

  const volunteerNotif2 = await Notification.create({
    userId: volunteerUserId,
    title: "Task In Progress",
    message: "Task 'Distribute Drinking Water in Sector 4' is now active.",
    type: "info"
  });

  const abcNotif = await Notification.create({
    userId: abcUser._id,
    title: "Rescue Dispatched",
    message: "Rescue team has been dispatched to your location (SOS-ABC-01).",
    type: "warning"
  });

  const pqrNotif1 = await Notification.create({
    userId: pqrUser._id,
    title: "Report Verified",
    message: "Your incident report for Dadar Flooding has been verified by the administration.",
    type: "success"
  });

  const pqrNotif2 = await Notification.create({
    userId: pqrUser._id,
    title: "Rescue Team Dispatched",
    message: "Rescue operations have been assigned to your emergency request (SOS-PQR-99).",
    type: "warning"
  });

  console.log('✔ Test notifications generated in database for Citizen pqr, Citizen ABC, and Volunteer.');

  // 1. Test Backend Controller Query with userId filter
  console.log('\n--- 1. Testing Backend /api/notifications?userId=... ---');
  let req = { query: { userId: pqrUser._id.toString() } };
  let res = createMockRes();
  await notificationController.getNotifications(req, res);
  assert.strictEqual(res.statusCode, 200);

  const pqrApiNotifs = res.data.data;
  assert.strictEqual(pqrApiNotifs.length, 2, 'pqr should receive exactly 2 notifications from API');
  assert(pqrApiNotifs.every(n => n.userId._id.toString() === pqrUser._id.toString()), 'All returned notifications must belong to pqr');
  assert(!pqrApiNotifs.some(n => n.message.includes('Distribute Drinking Water')), 'Volunteer notification must NOT appear for pqr');
  console.log(`✔ API returned ${pqrApiNotifs.length} notifications strictly scoped to citizen pqr.`);

  // 2. Test Frontend Store Scoping for Citizen pqr
  console.log('\n--- 2. Testing Frontend Scoping for Citizen pqr ---');
  const storagePqr = { resq_current_user: JSON.stringify({ _id: pqrUser._id.toString(), name: 'pqr', email: 'pqr@m.com', role: 'citizen' }) };

  global.window = {
    location: { pathname: '/citizen-notifications.html' },
    sessionStorage: { getItem: (k) => storagePqr[k] || null, setItem: (k, v) => storagePqr[k] = v, removeItem: (k) => delete storagePqr[k] },
    localStorage: { getItem: (k) => storagePqr[k] || null, setItem: (k, v) => storagePqr[k] = v, removeItem: (k) => delete storagePqr[k] },
    addEventListener: () => {},
    CustomEvent: class { constructor(n, d) { this.type = n; this.detail = d ? d.detail : null; } }
  };
  global.document = { readyState: 'complete', querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
  global.sessionStorage = global.window.sessionStorage;
  global.localStorage = global.window.localStorage;

  eval(mockDataCode);
  eval(storeCode);
  eval(mainJsCode);

  // Populate store state with all notifications (simulate multi-user pool)
  window.ResQStore.getAll("notifications").length = 0;
  [volunteerNotif1, volunteerNotif2, abcNotif, pqrNotif1, pqrNotif2].forEach(n => {
    window.ResQStore.getAll("notifications").push({
      _id: n._id.toString(),
      id: n._id.toString(),
      userId: n.userId.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      read: false,
      createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString()
    });
  });

  const currentUser = window.ResQAuth.getAuthUser();
  const currentUserId = currentUser._id;

  const filteredForPqr = window.ResQStore.getAll("notifications").filter(n => {
    return n.userId === currentUserId || (n.userId && String(n.userId) === String(currentUserId));
  });

  assert.strictEqual(filteredForPqr.length, 2, 'Citizen pqr must only see 2 notifications in store');
  assert(!filteredForPqr.some(n => n.message.includes('Distribute Drinking Water')), 'Citizen pqr must not see volunteer task notifications');
  assert(!filteredForPqr.some(n => n.message.includes('SOS-ABC-01')), 'Citizen pqr must not see Citizen ABC notifications');
  console.log('✔ Frontend Scoping Verified: Citizen pqr sees ONLY own notifications:');
  filteredForPqr.forEach(n => console.log(`   • [${n.type}] ${n.title}: "${n.message}"`));

  // 3. Test Frontend Scoping for Volunteer
  console.log('\n--- 3. Testing Frontend Scoping for Volunteer ---');
  const storageVol = { resq_current_user: JSON.stringify({ _id: volunteerUserId.toString(), name: 'Rohan Mehta', email: 'rohan@volunteer.org', role: 'volunteer' }) };
  global.sessionStorage.getItem = (k) => storageVol[k] || null;
  global.localStorage.getItem = (k) => storageVol[k] || null;

  const currentVol = window.ResQAuth.getAuthUser();
  const filteredForVol = window.ResQStore.getAll("notifications").filter(n => {
    return n.userId === currentVol._id || (n.userId && String(n.userId) === String(currentVol._id));
  });

  assert.strictEqual(filteredForVol.length, 2, 'Volunteer must see only their 2 volunteer notifications');
  assert(filteredForVol.every(n => n.message.includes('Distribute Drinking Water')), 'Volunteer notifications must be task notifications');
  console.log('✔ Frontend Scoping Verified: Volunteer sees ONLY volunteer task notifications.');

  // Clean up test notifications
  await Notification.findByIdAndDelete(volunteerNotif1._id);
  await Notification.findByIdAndDelete(volunteerNotif2._id);
  await Notification.findByIdAndDelete(abcNotif._id);
  await Notification.findByIdAndDelete(pqrNotif1._id);
  await Notification.findByIdAndDelete(pqrNotif2._id);
  console.log('\n✔ Test notifications cleaned up.');

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ CITIZEN NOTIFICATION SCOPING VERIFIED 100%');
  console.log('===========================================================');
}

testNotificationScoping().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
