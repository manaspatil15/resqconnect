require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const notifs = await Notification.find().populate('userId', 'name email role');
  console.log('=== CURRENT ACTIVE NOTIFICATIONS IN MONGODB ATLAS ===');
  notifs.forEach(n => {
    const u = n.userId || {};
    console.log(`• Target: ${u.name || 'System'} (${u.email || 'no-email'}) [Role: ${u.role || 'no-role'}] -> [${n.type.toUpperCase()}] "${n.title}": ${n.message}`);
  });
  await mongoose.disconnect();
}

audit().catch(console.error);
