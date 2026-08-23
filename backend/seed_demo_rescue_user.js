require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

async function seedRescueUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  const email = 'rescue@resqconnect.com';
  const name = 'Capt. Vikram Rao';
  const password = 'Rescue123';
  const role = 'rescue';
  const phone = '9876543210';

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      status: 'active',
      isActive: true
    });
    console.log(`✔ Permanent Demo Rescue User Created: ${user.name} (${user.email}) [ID: ${user._id}]`);
  } else {
    user.name = name;
    user.password = password;
    user.role = role;
    user.phone = phone;
    user.status = 'active';
    user.isActive = true;
    await user.save();
    console.log(`✔ Permanent Demo Rescue User Updated/Verified: ${user.name} (${user.email}) [ID: ${user._id}]`);
  }

  await mongoose.disconnect();
}

seedRescueUser().catch(err => {
  console.error('Error seeding demo rescue user:', err);
  process.exit(1);
});
