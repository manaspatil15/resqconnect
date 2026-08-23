require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const VolunteerTask = require('./models/VolunteerTask');
const Notification = require('./models/Notification');
const volunteerController = require('./controllers/volunteerTaskController');

console.log('=== STARTING VOLUNTEER WORKFLOW & INTEGRATION TESTS ===\n');

// Load frontend scripts into mock DOM environment for frontend assertion
const mockDataCode = fs.readFileSync(path.join(__dirname, '../js/mock/mock-data.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/mock/store.js'), 'utf8');
const mainJsCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // 1. Verify User ABC Exists & Test Volunteer Header Dynamics
  const citizenUser = await User.findOne({ email: 'abc@g.com' });
  assert(citizenUser, 'Citizen user abc@g.com must exist in database');
  console.log(`✔ User Account Verified: ${citizenUser.name} (${citizenUser.email})`);

  const volunteerUser = {
    _id: "6a8ae8888888888888888888",
    name: "Rohan Mehta",
    email: "rohan.volunteer@resqconnect.org",
    role: "volunteer",
    phone: "9876543211"
  };

  const storage = { resq_current_user: JSON.stringify(volunteerUser) };
  global.window = {
    location: { pathname: "/volunteer-dashboard.html" },
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
  assert.strictEqual(authUser.name, "Rohan Mehta", "Volunteer user name must normalize to Rohan Mehta");
  assert.strictEqual(authUser.role, "volunteer", "Volunteer user role must normalize to volunteer");
  
  const initials = window.ResQAuth.getInitials(authUser.name);
  assert.strictEqual(initials, "RM", "Initials for 'Rohan Mehta' must be 'RM'");
  console.log(`✔ Volunteer Header Dynamics: Name='${authUser.name}', Role='${authUser.role}', Initials='${initials}'`);

  // 2. Create an Available Volunteer Task in MongoDB Atlas
  console.log('\n--- 1. Creating Available Volunteer Task ---');
  const taskRef = `TSK-TEST-${Date.now().toString().slice(-4)}`;

  const createdTask = await VolunteerTask.create({
    taskId: taskRef,
    title: "Distribute Relief Ration Kits at Relief Camp 2",
    description: "Assist NGO team with packaging and handing out dry ration kits to 50 families.",
    location: "Dharavi Community Center, Mumbai",
    priority: "high",
    status: "available",
    volunteerId: null
  });

  console.log(`✔ Available Task Created in DB: ${createdTask.taskId} (Status: ${createdTask.status})`);

  // 3. Volunteer Accepts the Task: available -> accepted
  console.log('\n--- 2. Volunteer Accepts Task (available -> accepted) ---');
  let req = { params: { id: createdTask._id.toString() }, body: { status: "accepted", volunteerId: volunteerUser._id } };
  let resStatus = null;
  let resJson = null;
  let resMock = {
    status: (s) => { resStatus = s; return { json: (j) => { resJson = j; } }; }
  };

  await volunteerController.updateTaskStatus(req, resMock);
  assert.strictEqual(resStatus, 200, "Update to 'accepted' should return HTTP 200");

  const taskAfterAccepted = await VolunteerTask.findById(createdTask._id);
  assert.strictEqual(taskAfterAccepted.status, "accepted", "Task status should be accepted");
  assert.strictEqual(taskAfterAccepted.volunteerId.toString(), volunteerUser._id, "Task volunteerId must match accepting volunteer");
  console.log(`   ✔ Task ${taskAfterAccepted.taskId} accepted and assigned to Volunteer (${taskAfterAccepted.volunteerId})`);

  const notifAccepted = await Notification.findOne({ userId: volunteerUser._id, relatedId: createdTask._id, title: /Accepted/i });
  assert(notifAccepted, "Notification should be generated for volunteer when task is accepted");
  console.log(`   ✔ Notification Generated: "${notifAccepted.title}" - "${notifAccepted.message}"`);

  // 4. Volunteer Starts the Task: accepted -> in_progress
  console.log('\n--- 3. Volunteer Starts Task (accepted -> in_progress) ---');
  req = { params: { id: createdTask._id.toString() }, body: { status: "in_progress" } };
  await volunteerController.updateTaskStatus(req, resMock);
  assert.strictEqual(resStatus, 200, "Update to 'in_progress' should return HTTP 200");

  const taskAfterProgress = await VolunteerTask.findById(createdTask._id);
  assert.strictEqual(taskAfterProgress.status, "in_progress", "Task status should be in_progress");
  console.log(`   ✔ Task ${taskAfterProgress.taskId} status updated to in_progress`);

  const notifProgress = await Notification.findOne({ userId: volunteerUser._id, relatedId: createdTask._id, title: /In Progress/i });
  assert(notifProgress, "Notification should be generated for volunteer when task is in_progress");
  console.log(`   ✔ Notification Generated: "${notifProgress.title}" - "${notifProgress.message}"`);

  // 5. Volunteer Completes the Task: in_progress -> completed
  console.log('\n--- 4. Volunteer Completes Task (in_progress -> completed) ---');
  req = { params: { id: createdTask._id.toString() }, body: { status: "completed" } };
  await volunteerController.updateTaskStatus(req, resMock);
  assert.strictEqual(resStatus, 200, "Update to 'completed' should return HTTP 200");

  const taskAfterCompleted = await VolunteerTask.findById(createdTask._id);
  assert.strictEqual(taskAfterCompleted.status, "completed", "Task status should be completed");
  assert(taskAfterCompleted.completedAt, "Task completedAt timestamp must be set");
  console.log(`   ✔ Task ${taskAfterCompleted.taskId} completed at ${taskAfterCompleted.completedAt.toISOString()}`);

  const notifCompleted = await Notification.findOne({ userId: volunteerUser._id, relatedId: createdTask._id, title: /Completed/i });
  assert(notifCompleted, "Notification should be generated for volunteer when task is completed");
  console.log(`   ✔ Notification Generated: "${notifCompleted.title}" - "${notifCompleted.message}"`);

  // 6. Test Task Filtering (Available vs History)
  console.log('\n--- 5. Verifying Available vs Completed Task Scoping ---');
  const availableTasks = await VolunteerTask.find({ status: "available" });
  assert(!availableTasks.some(t => t._id.equals(createdTask._id)), "Completed task must NOT appear in available tasks");
  console.log('   ✔ Completed task correctly excluded from Available Tasks view.');

  const completedTasks = await VolunteerTask.find({ status: "completed", volunteerId: volunteerUser._id });
  assert(completedTasks.some(t => t._id.equals(createdTask._id)), "Completed task must appear in Volunteer History");
  console.log('   ✔ Completed task correctly present in Volunteer Task History.');

  // 7. Clean up temporary test task and notifications
  console.log('\n--- Cleaning up temporary test records ---');
  await VolunteerTask.findByIdAndDelete(createdTask._id);
  await Notification.deleteMany({ relatedId: createdTask._id });
  console.log('✔ Temporary test records cleaned up. Real user accounts remain intact.');

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ ALL VOLUNTEER WORKFLOW CHECKS PASSED (100%)');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
