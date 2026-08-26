require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const assert = require('assert');

const Report = require('./models/Report');

async function runDirectMongoTest() {
  console.log('================================================================');
  console.log('   TESTING CITIZEN SUBMISSION → MONGODB → ADMIN RETRIEVAL');
  console.log('================================================================\n');

  // 1. Citizen submits report via HTTP API
  const testTitle = `Flooding near Station ${Date.now()}`;
  const testLocation = "Kurla West, Mumbai";
  const testType = "Flood";
  const testDesc = "Water level rising rapidly on main road.";

  console.log('--- 1. Submitting Report via API (http://localhost:5000/api/reports) ---');
  const postRes = await fetch('http://localhost:5000/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: testType,
      title: testTitle,
      description: testDesc,
      location: testLocation
    })
  });

  assert.strictEqual(postRes.status, 201, 'Citizen POST /api/reports must return HTTP 201 Created');
  const postData = await postRes.json();
  assert(postData.success, 'Response must be success');
  const createdReport = postData.data;
  console.log(`✔ Citizen Submission Successful: Report ID ${createdReport.reportId || createdReport._id} created.`);

  // 2. Query MongoDB directly to verify document persistence
  console.log('\n--- 2. Checking MongoDB Database Directly ---');
  await mongoose.connect(process.env.MONGODB_URI);
  const mongoDoc = await Report.findOne({ $or: [{ reportId: createdReport.reportId }, { _id: createdReport._id }] });

  assert(mongoDoc, 'Report MUST exist in MongoDB database immediately after submission');
  assert.strictEqual(mongoDoc.type, testType, 'MongoDB type must match submitted type');
  assert.strictEqual(mongoDoc.location, testLocation, 'MongoDB location must match submitted location');
  assert.strictEqual(mongoDoc.status, 'pending', 'MongoDB status must be pending for Admin review');
  console.log(`✔ MongoDB Direct Query Verified: Document found in MongoDB!`);
  console.log(`   • DB ID: ${mongoDoc._id}`);
  console.log(`   • Report ID: ${mongoDoc.reportId}`);
  console.log(`   • Title: "${mongoDoc.title}"`);
  console.log(`   • Status: ${mongoDoc.status}`);
  console.log(`   • CreatedAt: ${mongoDoc.createdAt.toISOString()}`);

  // 3. Admin retrieves reports via GET /api/reports
  console.log('\n--- 3. Testing Admin Retrieval via API (http://localhost:5000/api/reports) ---');
  const getRes = await fetch('http://localhost:5000/api/reports');
  assert.strictEqual(getRes.status, 200, 'Admin GET /api/reports must return HTTP 200 OK');
  const getData = await getRes.json();
  assert(getData.success, 'Admin GET response must be success');

  const adminList = getData.data;
  const foundInAdmin = adminList.find(r => (r.reportId === createdReport.reportId || r._id === createdReport._id));
  assert(foundInAdmin, 'Submitted report MUST appear in Admin reports retrieval list');
  console.log(`✔ Admin Retrieval Verified: Report ${foundInAdmin.reportId} received by Admin API!`);

  // 4. Cleanup test document
  await Report.findByIdAndDelete(mongoDoc._id);
  console.log('\n✔ Test record cleaned up from MongoDB.');

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✔ CITIZEN SUBMISSION → MONGODB → ADMIN RETRIEVAL VERIFIED 100%');
  console.log('================================================================');
}

runDirectMongoTest().catch(err => {
  console.error('Direct Mongo Test Failed:', err);
  process.exit(1);
});
