require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Camp = require('./models/Camp');
const Notification = require('./models/Notification');
const Distribution = require('./models/Distribution');

async function testLiveDistribution() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.');

  const ngoUser = await User.findOne({ email: 'ngo@resqconnect.com' });
  const inv = await Inventory.findOne({ itemId: 'INV-2026-1001' });
  const camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });

  console.log(`Initial State: Item "${inv.name}" has ${inv.quantity} ${inv.unit}.`);
  const initialNotifsCount = await Notification.countDocuments({ userId: ngoUser._id });
  console.log(`Initial Notifications for Priya Nair: ${initialNotifsCount}`);

  // Call LIVE Backend HTTP API
  const payload = {
    ngoId: ngoUser._id.toString(),
    campId: camp._id.toString(),
    inventoryId: inv._id.toString(),
    quantity: 35 // Stock 70 - 35 = 35 <= 40 (triggers Low Stock Alert too)
  };

  const response = await fetch('http://localhost:5000/api/distributions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();
  console.log('HTTP POST /api/distributions Response:', resData);

  // Check MongoDB
  const updatedInv = await Inventory.findById(inv._id);
  console.log(`Updated Stock in MongoDB: ${updatedInv.quantity} ${updatedInv.unit}`);

  const notifs = await Notification.find({ userId: ngoUser._id }).sort({ createdAt: -1 });
  console.log(`\nCurrent Notifications for Priya Nair in MongoDB (${notifs.length}):`);
  notifs.forEach(n => {
    console.log(` • [ID: ${n._id}] [${n.type.toUpperCase()}] "${n.title}": ${n.message} (Read: ${n.isRead})`);
  });

  await mongoose.disconnect();
}

testLiveDistribution().catch(console.error);
