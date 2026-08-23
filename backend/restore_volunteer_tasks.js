require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const VolunteerTask = require('./models/VolunteerTask');

async function restoreVolunteerTasks() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  const tasksToRestore = [
    {
      taskId: 'TSK-2026-1001',
      title: 'Emergency Food Ration Kit Distribution',
      description: 'Assist with unloading and distributing 150 ration packs to displaced families.',
      location: 'Dharavi Relief Center 2',
      priority: 'high',
      status: 'available',
      volunteerId: null,
      completedAt: null
    },
    {
      taskId: 'TSK-2026-1002',
      title: 'Medical Aid First-Response Support',
      description: 'Support relief camp medical team with crowd management and basic supplies.',
      location: 'Kurla West Shelter',
      priority: 'critical',
      status: 'available',
      volunteerId: null,
      completedAt: null
    }
  ];

  for (const item of tasksToRestore) {
    let task = await VolunteerTask.findOne({ taskId: item.taskId });
    if (!task) {
      task = await VolunteerTask.create(item);
      console.log(`✔ Created Volunteer Task: ${task.taskId} - "${task.title}"`);
    } else {
      task.title = item.title;
      task.description = item.description;
      task.location = item.location;
      task.priority = item.priority;
      task.status = 'available';
      task.volunteerId = null;
      task.completedAt = null;
      await task.save();
      console.log(`✔ Restored Volunteer Task: ${task.taskId} - "${task.title}"`);
    }
  }

  console.log('\n--- Verifying All Available Volunteer Tasks in MongoDB Atlas ---');
  const availableTasks = await VolunteerTask.find({ status: 'available' });
  availableTasks.forEach(t => {
    console.log(`• Task ID: ${t.taskId}`);
    console.log(`  Title: ${t.title}`);
    console.log(`  Location: ${t.location}`);
    console.log(`  Priority: ${t.priority}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Volunteer ID: ${t.volunteerId}`);
    console.log(`  Completed At: ${t.completedAt}\n`);
  });

  await mongoose.disconnect();
}

restoreVolunteerTasks().catch(err => {
  console.error('Error restoring volunteer tasks:', err);
  process.exit(1);
});
