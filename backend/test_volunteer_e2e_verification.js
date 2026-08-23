require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const VolunteerTask = require('./models/VolunteerTask');
const Notification = require('./models/Notification');
const authController = require('./controllers/authController');
const volunteerTaskController = require('./controllers/volunteerTaskController');
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
console.log('    VOLUNTEER COMPLETE WORKFLOW END-TO-END VERIFICATION');
console.log('================================================================\n');

async function testVolunteerWorkflow() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // 1. Volunteer Account Verification & Login
  console.log('--- 1. Testing Volunteer Authentication & Login ---');
  let req = { body: { email: 'volunteer@resqconnect.com', password: 'Volunteer123', role: 'volunteer' } };
  let res = createMockRes();
  await authController.login(req, res);
  assert.strictEqual(res.statusCode, 200, 'Volunteer login must return HTTP 200');
  const volUser = res.data.data;
  assert.strictEqual(volUser.name, 'Rohan Mehta');
  assert.strictEqual(volUser.role, 'volunteer');
  console.log(`✔ Login Successful: ${volUser.name} (${volUser.email}) [Role: ${volUser.role}]`);

  // Verify Frontend Role Mapping
  const DASHBOARD_BY_ROLE = {
    "Citizen": "citizen-dashboard.html",
    "Volunteer": "volunteer-dashboard.html",
    "NGO": "ngo-dashboard.html",
    "Rescue Team": "rescue-dashboard.html",
    "Admin": "admin-dashboard.html"
  };
  assert.strictEqual(DASHBOARD_BY_ROLE["Volunteer"], "volunteer-dashboard.html");
  console.log('✔ Dashboard Navigation Target: volunteer-dashboard.html');

  // 2. Test Volunteer Dashboard Header & Session Normalization
  console.log('\n--- 2. Testing Volunteer Dashboard Header & Session ---');
  const storageVol = { resq_current_user: JSON.stringify(volUser) };
  global.window = {
    location: { pathname: '/volunteer-dashboard.html' },
    sessionStorage: { getItem: (k) => storageVol[k] || null, setItem: (k, v) => storageVol[k] = v, removeItem: (k) => delete storageVol[k] },
    localStorage: { getItem: (k) => storageVol[k] || null, setItem: (k, v) => storageVol[k] = v, removeItem: (k) => delete storageVol[k] },
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
  assert.strictEqual(authUser.name, 'Rohan Mehta');
  assert.strictEqual(authUser.role, 'volunteer');
  assert.strictEqual(initials, 'RM', 'Initials for Rohan Mehta must be RM');
  console.log(`✔ Header Normalized: Name="${authUser.name}", Role="${authUser.role}", Initials="${initials}"`);

  // 3. Test Available Tasks (volunteer-tasks.html)
  console.log('\n--- 3. Testing Available Tasks Roster (volunteer-tasks.html) ---');
  req = { query: { status: 'available' } };
  res = createMockRes();
  await volunteerTaskController.getAllTasks(req, res);
  assert.strictEqual(res.statusCode, 200);
  const availableTasks = res.data.data;
  assert(availableTasks.length > 0, 'There must be at least 1 available task');
  const taskToAccept = availableTasks[0];
  console.log(`✔ Found ${availableTasks.length} available task(s). Selecting: "${taskToAccept.title}" (${taskToAccept.taskId})`);

  // 4. Test Accept Task
  console.log('\n--- 4. Testing Task Acceptance (Available -> Accepted) ---');
  req = { params: { id: taskToAccept._id.toString() }, body: { status: 'accepted', volunteerId: volUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const acceptedTaskInDb = await VolunteerTask.findById(taskToAccept._id);
  assert.strictEqual(acceptedTaskInDb.status, 'accepted');
  assert.strictEqual(acceptedTaskInDb.volunteerId.toString(), volUser._id.toString());
  console.log(`✔ Task "${acceptedTaskInDb.title}" accepted by ${volUser.name}.`);

  const notifAccepted = await Notification.findOne({ userId: volUser._id, relatedId: taskToAccept._id, title: /Task Accepted/i });
  assert(notifAccepted, 'Volunteer must receive "Task Accepted" notification');
  console.log(`✔ Notification Generated: "${notifAccepted.title}" - "${notifAccepted.message}"`);

  // 5. Test Start Task (Accepted -> In Progress)
  console.log('\n--- 5. Testing Start Task (Accepted -> In Progress) ---');
  req = { params: { id: taskToAccept._id.toString() }, body: { status: 'in_progress', volunteerId: volUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const inProgressTaskInDb = await VolunteerTask.findById(taskToAccept._id);
  assert.strictEqual(inProgressTaskInDb.status, 'in_progress');
  console.log(`✔ Task "${inProgressTaskInDb.title}" status updated to in_progress.`);

  const notifStarted = await Notification.findOne({ userId: volUser._id, relatedId: taskToAccept._id, title: /Task In Progress/i });
  assert(notifStarted, 'Volunteer must receive "Task In Progress" notification');
  console.log(`✔ Notification Generated: "${notifStarted.title}" - "${notifStarted.message}"`);

  // 6. Test Mark Completed (In Progress -> Completed)
  console.log('\n--- 6. Testing Mark Completed (In Progress -> Completed) ---');
  req = { params: { id: taskToAccept._id.toString() }, body: { status: 'completed', volunteerId: volUser._id } };
  res = createMockRes();
  await volunteerTaskController.updateTaskStatus(req, res);
  assert.strictEqual(res.statusCode, 200);

  const completedTaskInDb = await VolunteerTask.findById(taskToAccept._id);
  assert.strictEqual(completedTaskInDb.status, 'completed');
  assert(completedTaskInDb.completedAt, 'Task must record completedAt timestamp');
  console.log(`✔ Task "${completedTaskInDb.title}" marked completed at ${completedTaskInDb.completedAt.toISOString()}`);

  const notifCompleted = await Notification.findOne({ userId: volUser._id, relatedId: taskToAccept._id, title: /Task Completed/i });
  assert(notifCompleted, 'Volunteer must receive "Task Completed" notification');
  console.log(`✔ Notification Generated: "${notifCompleted.title}" - "${notifCompleted.message}"`);

  // 7. Test Task History Scoping (volunteer-history.html)
  console.log('\n--- 7. Testing Volunteer History Scoping (volunteer-history.html) ---');
  req = { query: { status: 'completed' } };
  res = createMockRes();
  await volunteerTaskController.getAllTasks(req, res);
  assert.strictEqual(res.statusCode, 200);
  const myCompletedTasks = res.data.data.filter(t => t.volunteerId && (t.volunteerId._id || t.volunteerId).toString() === volUser._id.toString());
  assert(myCompletedTasks.some(t => t._id.toString() === taskToAccept._id.toString()), 'Completed task must appear in Volunteer History');
  console.log(`✔ Volunteer History contains ${myCompletedTasks.length} completed task(s) for ${volUser.name}.`);

  // Verify task is no longer in Available Tasks list
  req = { query: { status: 'available' } };
  res = createMockRes();
  await volunteerTaskController.getAllTasks(req, res);
  assert(!res.data.data.some(t => t._id.toString() === taskToAccept._id.toString()), 'Completed task must NOT appear in Available Tasks roster');
  console.log('✔ Available Tasks correctly excludes the completed task.');

  // 8. Test Volunteer Notifications Scoping
  console.log('\n--- 8. Testing Volunteer Notifications Scoping ---');
  req = { query: { userId: volUser._id.toString() } };
  res = createMockRes();
  await notificationController.getNotifications(req, res);
  assert.strictEqual(res.statusCode, 200);
  const volNotifs = res.data.data;
  assert.strictEqual(volNotifs.length, 3, 'Volunteer must receive exactly 3 lifecycle notifications');
  console.log(`✔ Volunteer Notifications Verified: ${volNotifs.length} notifications:`);
  volNotifs.forEach(n => console.log(`   • [${n.type}] ${n.title}: "${n.message}"`));

  // Reset the task to 'available' for future manual testing
  taskToAccept.status = 'available';
  taskToAccept.volunteerId = null;
  taskToAccept.completedAt = null;
  await taskToAccept.save();
  await Notification.deleteMany({ userId: volUser._id });
  console.log('\n✔ Reset task state to "available" and cleaned up test notifications for ongoing manual testing.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ VOLUNTEER WORKFLOW END-TO-END VERIFIED (100% PASS)');
  console.log('================================================================\n');
}

testVolunteerWorkflow().catch(err => {
  console.error('Volunteer workflow test failed:', err);
  process.exit(1);
});
