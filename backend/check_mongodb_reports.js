require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');

const Report = require('./models/Report');
const SOS = require('./models/SOS');
const User = require('./models/User');

async function checkMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== CHECKING MONGODB DATABASE DIRECTLY ===\n');

  // 1. Check Reports Collection
  const reports = await Report.find().populate('citizenId', 'name email').sort({ createdAt: -1 });
  console.log(`--- [REPORTS COLLECTION] (${reports.length} documents) ---`);
  if (reports.length === 0) {
    console.log('No report documents found in MongoDB.');
  } else {
    reports.forEach((r, idx) => {
      const cName = r.citizenId ? r.citizenId.name : 'N/A';
      console.log(`${idx + 1}. Code: ${r.reportId || r._id} | Type: ${r.type} | Location: ${r.location} | Status: ${r.status} | FiledBy: ${cName} | CreatedAt: ${r.createdAt}`);
    });
  }

  // 2. Check SOS Collection
  console.log('\n--- [SOS COLLECTION] ---');
  const sosList = await SOS.find().sort({ createdAt: -1 });
  console.log(`Total SOS documents in MongoDB: ${sosList.length}`);
  sosList.forEach((s, idx) => {
    console.log(`${idx + 1}. Ref: ${s.referenceNumber || s.sosId || s._id} | Emergency: ${s.emergencyType} | Status: ${s.status} | CreatedAt: ${s.createdAt}`);
  });

  // 3. Check Users Collection
  console.log('\n--- [USERS COLLECTION] ---');
  const users = await User.find().select('name email role status createdAt');
  console.log(`Total users in MongoDB: ${users.length}`);
  users.forEach((u, idx) => {
    console.log(`${idx + 1}. Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | Status: ${u.status}`);
  });

  await mongoose.disconnect();
  console.log('\n===========================================================');
  console.log('✔ MONGODB DIRECT DATABASE AUDIT COMPLETE');
  console.log('===========================================================');
}

checkMongo().catch(err => {
  console.error('MongoDB Check Error:', err);
  process.exit(1);
});
