require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const VolunteerTask = require('./models/VolunteerTask');

async function seedVolunteerData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  // 1. Seed / Update Demo Volunteer User
  const email = 'volunteer@resqconnect.com';
  const name = 'Rohan Mehta';
  const password = 'Volunteer123';
  const role = 'volunteer';
  const phone = '9876543222';

  let volUser = await User.findOne({ email });
  if (!volUser) {
    volUser = await User.create({
      name,
      email,
      password,
      role,
      phone,
      status: 'active',
      isActive: true
    });
    console.log(`✔ Permanent Demo Volunteer User Created: ${volUser.name} (${volUser.email}) [ID: ${volUser._id}]`);
  } else {
    volUser.name = name;
    volUser.password = password;
    volUser.role = role;
    volUser.phone = phone;
    volUser.status = 'active';
    volUser.isActive = true;
    await volUser.save();
    console.log(`✔ Permanent Demo Volunteer User Updated: ${volUser.name} (${volUser.email}) [ID: ${volUser._id}]`);
  }

  // 2. Seed Initial Available Tasks if needed
  const sampleTasks = [
    {
      taskId: 'TSK-2026-1001',
      title: 'Emergency Food Ration Kit Distribution',
      description: 'Assist with unloading and distributing 150 ration packs to displaced families.',
      location: 'Dharavi Relief Center 2',
      priority: 'high',
      status: 'available',
      volunteerId: null
    },
    {
      taskId: 'TSK-2026-1002',
      title: 'Medical Aid First-Response Support',
      description: 'Support relief camp medical team with crowd management and basic supplies.',
      location: 'Kurla West Shelter',
      priority: 'critical',
      status: 'available',
      volunteerId: null
    }
  ];

  for (const t of sampleTasks) {
    let existing = await VolunteerTask.findOne({ taskId: t.taskId });
    if (!existing) {
      existing = await VolunteerTask.create(t);
      console.log(`✔ Seeded Available Volunteer Task: ${existing.taskId} - "${existing.title}"`);
    } else {
      existing.status = 'available';
      existing.volunteerId = null;
      existing.completedAt = null;
      await existing.save();
      console.log(`✔ Available Volunteer Task Ready: ${existing.taskId} (Status: ${existing.status})`);
    }
  }

  await mongoose.disconnect();
}

seedVolunteerData().catch(err => {
  console.error('Error seeding demo volunteer data:', err);
  process.exit(1);
});
