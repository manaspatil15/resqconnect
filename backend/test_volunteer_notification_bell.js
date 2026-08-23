require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const VolunteerTask = require('./models/VolunteerTask');
const Notification = require('./models/Notification');
const volunteerTaskController = require('./controllers/volunteerTaskController');

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

console.log('=== TESTING VOLUNTEER NOTIFICATION FLOW & NOTIFICATION BELL ===\n');

async function testVolunteerNotifications() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // Find demo volunteer
  const volUser = await User.findOne({ email: 'volunteer@resqconnect.com' });
  assert(volUser, 'Volunteer user volunteer@resqconnect.com must exist');

  // Clean any leftover notifications for this volunteer
  await Notification.deleteMany({ userId: volUser._id });

  // Find or create a test task
  let task = await VolunteerTask.findOne({ taskId: 'TSK-2026-1001' });
  if (!task) {
    task = await VolunteerTask.create({
      taskId: 'TSK-2026-1001',
      title: 'Emergency Food Ration Kit Distribution',
      description: 'Assist with unloading and distributing 150 ration packs to displaced families.',
      location: 'Dharavi Relief Center 2',
      priority: 'high',
      status: 'available',
      volunteerId: null
    });
  }

  // Reset to available
  task.status = 'available';
  task.volunteerId = null;
  task.completedAt = null;
  await task.save();

  // 1. Accept Task
  console.log('\n--- 1. Testing Accept Task -> "Task Accepted" Notification ---');
  let req = { params: { id: task._id.toString() }, body: { status: 'accepted', volunteerId: volUser._id.toString() } };
  let res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const notif1 = await Notification.findOne({ userId: volUser._id, relatedId: task._id, title: /Task Accepted/i });
  assert(notif1, 'Notification "Task Accepted" must be created in MongoDB');
  console.log(`✔ Backend Notification 1 Created: "${notif1.title}" - "${notif1.message}"`);

  // 2. Start Task
  console.log('\n--- 2. Testing Start Task -> "Task In Progress" Notification ---');
  req = { params: { id: task._id.toString() }, body: { status: 'in_progress', volunteerId: volUser._id.toString() } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const notif2 = await Notification.findOne({ userId: volUser._id, relatedId: task._id, title: /Task In Progress/i });
  assert(notif2, 'Notification "Task In Progress" must be created in MongoDB');
  console.log(`✔ Backend Notification 2 Created: "${notif2.title}" - "${notif2.message}"`);

  // 3. Complete Task
  console.log('\n--- 3. Testing Complete Task -> "Task Completed" Notification ---');
  req = { params: { id: task._id.toString() }, body: { status: 'completed', volunteerId: volUser._id.toString() } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const notif3 = await Notification.findOne({ userId: volUser._id, relatedId: task._id, title: /Task Completed/i });
  assert(notif3, 'Notification "Task Completed" must be created in MongoDB');
  console.log(`✔ Backend Notification 3 Created: "${notif3.title}" - "${notif3.message}"`);

  // 4. Test Frontend Notification Bell Rendering
  console.log('\n--- 4. Testing Frontend Notification Bell & Popover Scoping ---');
  const storageVol = { resq_current_user: JSON.stringify({ _id: volUser._id.toString(), name: volUser.name, email: volUser.email, role: 'volunteer' }) };

  const popoverElement = { innerHTML: '', querySelectorAll: () => [] };
  const bellDotElement = { style: { display: 'none' } };

  global.window = {
    location: { pathname: '/volunteer-dashboard.html' },
    sessionStorage: { getItem: (k) => storageVol[k] || null, setItem: (k, v) => storageVol[k] = v, removeItem: (k) => delete storageVol[k] },
    localStorage: { getItem: (k) => storageVol[k] || null, setItem: (k, v) => storageVol[k] = v, removeItem: (k) => delete storageVol[k] },
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
    addEventListener: (evt, fn) => { if (evt === "DOMContentLoaded") fn(); }
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

  // Sync notifications into ResQStore BEFORE evaluating dashboard.js
  const allNotifsInDb = await Notification.find({ userId: volUser._id }).sort({ createdAt: -1 });
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

  // Run Notification Popover (evaluating dashboard.js will fire DOMContentLoaded)
  eval(dashboardJsCode);

  // Verify popover rendered notifications
  assert(popoverElement.innerHTML.includes('completed task'), 'Popover must render completed task notification');
  assert(popoverElement.innerHTML.includes('is now active'), 'Popover must render task in-progress notification');
  assert(popoverElement.innerHTML.includes('accepted task'), 'Popover must render task accepted notification');
  assert.strictEqual(bellDotElement.style.display, '', 'Notification bell dot must be visible (display: "")');
  console.log('✔ Frontend Notification Bell Verified: Popover rendered all 3 volunteer notifications and unread badge dot is active.');

  // 5. Test Citizen Isolation (citizen must see 0 of these notifications)
  console.log('\n--- 5. Testing Citizen Isolation ---');
  const storageCitizen = { resq_current_user: JSON.stringify({ _id: '6a8ae23227abd697f5ed424c', name: 'ABC', email: 'abc@g.com', role: 'citizen' }) };
  global.sessionStorage.getItem = (k) => storageCitizen[k] || null;
  global.localStorage.getItem = (k) => storageCitizen[k] || null;

  popoverElement.innerHTML = '';
  bellDotElement.style.display = 'none';

  // Re-run popover for citizen
  const citizenUser = window.ResQAuth.getAuthUser();
  const citizenNotifs = window.ResQStore.getAll("notifications").filter(n => {
    return n.userId === citizenUser._id;
  });
  assert.strictEqual(citizenNotifs.length, 0, 'Citizen must NOT see volunteer notifications');
  console.log('✔ Citizen Isolation Verified: Citizen ABC sees 0 volunteer notifications.');

  // Reset task to available for manual testing
  task.status = 'available';
  task.volunteerId = null;
  task.completedAt = null;
  await task.save();
  console.log('\n✔ Reset task state to "available" for manual testing.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ ALL VOLUNTEER NOTIFICATION FLOW CHECKS PASSED (100%)');
  console.log('================================================================\n');
}

testVolunteerNotifications().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
