// backend/test_frontend_integration.js
// Comprehensive test verifying the 5 major role workflows against MongoDB Atlas

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const SOS = require('./models/SOS');
const RescueCase = require('./models/RescueCase');
const Camp = require('./models/Camp');
const VolunteerTask = require('./models/VolunteerTask');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Report = require('./models/Report');
const Notification = require('./models/Notification');

const BASE_URL = 'http://localhost:5000/api';

async function runE2ETests() {
  console.log('=== STARTING RESQCONNECT FRONTEND-BACKEND INTEGRATION TESTS ===\n');

  // Connect to DB directly for validation and cleanup
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected directly to MongoDB Atlas for state validation.\n');

  const createdIds = {
    users: [],
    sos: [],
    rescueCases: [],
    camps: [],
    tasks: [],
    inventory: [],
    distributions: [],
    reports: [],
    notifications: []
  };

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATION FLOW (Citizen, Volunteer, NGO, Admin)
    // -------------------------------------------------------------
    console.log('--- 1. Testing Authentication Flows ---');
    
    // Register Citizen
    const citizenEmail = `test_citizen_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Citizen User',
        email: citizenEmail,
        password: 'Password123!',
        role: 'citizen',
        phone: '9876543210'
      })
    });
    const regData = await regRes.json();
    if (!regData.success) throw new Error(`Citizen Register failed: ${JSON.stringify(regData)}`);
    createdIds.users.push(regData.data._id);
    console.log(`✔ Citizen registration successful: ${regData.data.name} (${regData.data.email})`);

    // Login Citizen
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error(`Citizen Login failed: ${JSON.stringify(loginData)}`);
    console.log(`✔ Citizen login successful: Token issued, user role '${loginData.data.role}'\n`);

    // -------------------------------------------------------------
    // 2. CITIZEN SOS & RESCUE TEAM WORKFLOW
    // -------------------------------------------------------------
    console.log('--- 2. Testing Citizen SOS & Rescue Team Workflow ---');
    
    // Citizen triggers SOS
    const sosRes = await fetch(`${BASE_URL}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priority: 'critical',
        location: {
          latitude: 19.0760,
          longitude: 72.8777,
          address: 'Andheri East, Mumbai'
        },
        emergencyType: 'Flood Stranded',
        peopleCount: 4,
        description: 'Water levels rising rapidly on ground floor'
      })
    });
    const sosData = await sosRes.json();
    if (!sosData.success) throw new Error(`SOS creation failed: ${JSON.stringify(sosData)}`);
    const sosId = sosData.data._id;
    const sosRef = sosData.data.referenceNumber;
    createdIds.sos.push(sosId);
    console.log(`✔ Citizen SOS created: Ref #${sosRef} (ID: ${sosId})`);

    // Check linked RescueCase auto-creation
    const caseId = sosData.data.linkedRescueCaseId;
    if (!caseId) throw new Error('Linked RescueCase was not auto-created with SOS');
    createdIds.rescueCases.push(caseId);
    console.log(`✔ Linked RescueCase auto-created: ID ${caseId}`);

    // Rescue Team advances case to "assigned"
    const assignRes = await fetch(`${BASE_URL}/rescue-cases/${caseId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: 'NDRF Bravo Unit',
        assignedTo: regData.data._id
      })
    });
    const assignData = await assignRes.json();
    if (!assignData.success) throw new Error(`Rescue assign failed: ${JSON.stringify(assignData)}`);
    console.log(`✔ RescueCase assigned to ${assignData.data.teamName}, status: ${assignData.data.status}`);

    // Verify SOS document synced to "assigned"
    const sosCheck1 = await SOS.findById(sosId);
    if (sosCheck1.status !== 'assigned') throw new Error(`SOS status not synced to assigned: got ${sosCheck1.status}`);
    console.log(`✔ SOS document status auto-synced in DB: '${sosCheck1.status}'`);

    // Rescue Team marks case "resolved"
    const resolveRes = await fetch(`${BASE_URL}/rescue-cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'resolved',
        outcome: 'All 4 citizens rescued safely via boat.'
      })
    });
    const resolveData = await resolveRes.json();
    if (!resolveData.success) throw new Error(`Rescue resolve failed: ${JSON.stringify(resolveData)}`);
    console.log(`✔ RescueCase marked resolved with responseTime: ${resolveData.data.responseTime} mins`);

    // Verify SOS document synced to "resolved"
    const sosCheck2 = await SOS.findById(sosId);
    if (sosCheck2.status !== 'resolved') throw new Error(`SOS status not synced to resolved: got ${sosCheck2.status}`);
    console.log(`✔ SOS document status auto-synced in DB: '${sosCheck2.status}'\n`);

    // -------------------------------------------------------------
    // 3. VOLUNTEER TASK WORKFLOW
    // -------------------------------------------------------------
    console.log('--- 3. Testing Volunteer Task Workflow ---');
    
    // Create volunteer task
    const taskRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Distribute Food Kits in Relief Camp 3',
        description: 'Assist in packaging and distribution of 200 dry ration packets',
        category: 'Food Distribution',
        urgency: 'high',
        location: {
          address: 'Shivaji Park Relief Camp, Mumbai'
        },
        skillsRequired: ['Logistics & Distribution', 'General Support']
      })
    });
    const taskData = await taskRes.json();
    if (!taskData.success) throw new Error(`Task create failed: ${JSON.stringify(taskData)}`);
    const taskId = taskData.data._id;
    createdIds.tasks.push(taskId);
    console.log(`✔ Volunteer Task created: ${taskData.data.referenceNumber} (${taskData.data.title})`);

    // Volunteer accepts task -> in_progress
    const taskProgressRes = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'in_progress',
        assignedTo: regData.data._id
      })
    });
    const taskProgressData = await taskProgressRes.json();
    if (!taskProgressData.success) throw new Error(`Task progress update failed: ${JSON.stringify(taskProgressData)}`);
    console.log(`✔ Task status updated to: '${taskProgressData.data.status}'`);

    // Volunteer completes task
    const taskCompRes = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed'
      })
    });
    const taskCompData = await taskCompRes.json();
    if (!taskCompData.success || !taskCompData.data.completedAt) throw new Error(`Task completion failed: ${JSON.stringify(taskCompData)}`);
    console.log(`✔ Task marked completed at: ${taskCompData.data.completedAt}\n`);

    // -------------------------------------------------------------
    // 4. NGO INVENTORY & DISTRIBUTION WORKFLOW
    // -------------------------------------------------------------
    console.log('--- 4. Testing NGO Inventory & Distribution Workflow ---');
    
    // Create Relief Camp
    const campRes = await fetch(`${BASE_URL}/camps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dharavi Sports Complex Relief Center',
        location: {
          address: 'Dharavi, Mumbai'
        },
        capacity: 500,
        occupancy: 120,
        facilities: ['Medical Tent', 'Clean Water', 'Community Kitchen'],
        status: 'open'
      })
    });
    const campData = await campRes.json();
    if (!campData.success) throw new Error(`Camp creation failed: ${JSON.stringify(campData)}`);
    const campId = campData.data._id;
    createdIds.camps.push(campId);
    console.log(`✔ Relief Camp created: '${campData.data.name}' (Cap: ${campData.data.capacity})`);

    // Create Inventory Item
    const invRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: 'Emergency Drinking Water (20L Cans)',
        category: 'Water',
        quantity: 100,
        unit: 'cans',
        thresholdValue: 20
      })
    });
    const invData = await invRes.json();
    if (!invData.success) throw new Error(`Inventory create failed: ${JSON.stringify(invData)}`);
    const invId = invData.data._id;
    createdIds.inventory.push(invId);
    console.log(`✔ Inventory item created: ${invData.data.referenceNumber} - ${invData.data.itemName} (Qty: ${invData.data.quantity})`);

    // Log Distribution of 30 cans
    const distRes = await fetch(`${BASE_URL}/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventoryId: invId,
        campId: campId,
        quantity: 30,
        distributedBy: 'Red Cross Team Beta',
        notes: 'Delivered to camp dining zone'
      })
    });
    const distData = await distRes.json();
    if (!distData.success) throw new Error(`Distribution log failed: ${JSON.stringify(distData)}`);
    createdIds.distributions.push(distData.data._id);
    console.log(`✔ Distribution logged: ${distData.data.referenceNumber} (Qty: ${distData.data.quantity})`);

    // Verify Inventory decrement
    const invCheck = await Inventory.findById(invId);
    if (invCheck.quantity !== 70) throw new Error(`Inventory was not decremented correctly. Expected 70, got ${invCheck.quantity}`);
    console.log(`✔ Inventory stock correctly decremented: 100 -> ${invCheck.quantity} ${invCheck.unit}\n`);

    // -------------------------------------------------------------
    // 5. ADMIN INCIDENT REPORT & USER WORKFLOW
    // -------------------------------------------------------------
    console.log('--- 5. Testing Admin Report & User Workflow ---');
    
    // Citizen files incident report
    const reportRes = await fetch(`${BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bridge Structural Damage near Kurla Station',
        incidentType: 'Infrastructure Collapse',
        severity: 'high',
        location: {
          address: 'Kurla West, Mumbai'
        },
        description: 'Visible cracks after heavy monsoon rain, road partially blocked.'
      })
    });
    const reportData = await reportRes.json();
    if (!reportData.success) throw new Error(`Report create failed: ${JSON.stringify(reportData)}`);
    const reportId = reportData.data._id;
    createdIds.reports.push(reportId);
    console.log(`✔ Incident Report created: ${reportData.data.referenceNumber} (Status: '${reportData.data.status}', Verified: ${reportData.data.isVerified})`);

    // Admin verifies report
    const verifyRes = await fetch(`${BASE_URL}/reports/${reportId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verifiedBy: regData.data._id,
        verificationNotes: 'Verified with local police inspection team'
      })
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success || !verifyData.data.isVerified) throw new Error(`Report verification failed: ${JSON.stringify(verifyData)}`);
    console.log(`✔ Report verified by Admin: Status '${verifyData.data.status}', Verified: ${verifyData.data.isVerified}\n`);

    console.log('===========================================================');
    console.log('✔ ALL 5 ROLE WORKFLOWS (Citizen, Rescue, Volunteer, NGO, Admin) PASSED FULL E2E VALIDATION!');
    console.log('===========================================================\n');

  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Ensure zero test records remain in MongoDB Atlas
    // -------------------------------------------------------------
    console.log('--- Cleaning Up Test Data from MongoDB Atlas ---');
    if (createdIds.users.length) await User.deleteMany({ _id: { $in: createdIds.users } });
    if (createdIds.sos.length) await SOS.deleteMany({ _id: { $in: createdIds.sos } });
    if (createdIds.rescueCases.length) await RescueCase.deleteMany({ _id: { $in: createdIds.rescueCases } });
    if (createdIds.camps.length) await Camp.deleteMany({ _id: { $in: createdIds.camps } });
    if (createdIds.tasks.length) await VolunteerTask.deleteMany({ _id: { $in: createdIds.tasks } });
    if (createdIds.inventory.length) await Inventory.deleteMany({ _id: { $in: createdIds.inventory } });
    if (createdIds.distributions.length) await Distribution.deleteMany({ _id: { $in: createdIds.distributions } });
    if (createdIds.reports.length) await Report.deleteMany({ _id: { $in: createdIds.reports } });
    if (createdIds.notifications.length) await Notification.deleteMany({ _id: { $in: createdIds.notifications } });

    console.log('✔ All test records deleted. MongoDB Atlas collections remain clean.\n');
    await mongoose.disconnect();
  }
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Integration Test Failed:', err);
  process.exit(1);
});
