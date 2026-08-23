require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');

async function seedAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  const email = 'admin@resqconnect.com';
  const name = 'Rajesh Sharma';
  const password = 'Admin123';
  const role = 'admin';
  const phone = '9876540000';

  let adminUser = await User.findOne({ email });
  if (!adminUser) {
    adminUser = await User.create({
      name,
      email,
      password,
      role,
      phone,
      status: 'active',
      isActive: true
    });
    console.log(`✔ Created Permanent Demo Admin User: ${adminUser.name} (${adminUser.email}) [ID: ${adminUser._id}]`);
  } else {
    adminUser.name = name;
    adminUser.password = password;
    adminUser.role = role;
    adminUser.phone = phone;
    adminUser.status = 'active';
    adminUser.isActive = true;
    await adminUser.save();
    console.log(`✔ Updated Permanent Demo Admin User: ${adminUser.name} (${adminUser.email}) [ID: ${adminUser._id}]`);
  }

  // Ensure Admin notification exists
  let notif = await Notification.findOne({ userId: adminUser._id });
  if (!notif) {
    notif = await Notification.create({
      userId: adminUser._id,
      title: "System Initialization",
      message: "Platform services operational. All regional channels active.",
      type: "info",
      isRead: false
    });
    console.log(`✔ Seeded Admin Notification: "${notif.title}" - "${notif.message}"`);
  } else {
    console.log(`✔ Admin Notification Verified: "${notif.title}" - "${notif.message}"`);
  }

  await mongoose.disconnect();
}

seedAdmin().catch(err => {
  console.error('Error seeding demo admin:', err);
  process.exit(1);
});
