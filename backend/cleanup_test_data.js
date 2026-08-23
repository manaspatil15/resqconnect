require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  // Only remove temporary automated test accounts
  await User.deleteMany({ email: { $regex: '^(test_|qa_|temp_)' } });
  const users = await User.find();
  console.log('Current Registered Users in MongoDB Atlas:');
  console.log(users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status })));
  await mongoose.disconnect();
}

clean().catch(console.error);
