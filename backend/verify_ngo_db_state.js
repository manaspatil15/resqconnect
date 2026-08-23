require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Notification = require('./models/Notification');

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== NGO USER IN MONGODB ATLAS ===');
  const ngo = await User.findOne({ email: 'ngo@resqconnect.com' });
  console.log(`User ID: ${ngo._id} | Name: ${ngo.name} | Role: ${ngo.role} | Email: ${ngo.email}`);

  console.log('\n=== INVENTORY ITEMS IN MONGODB ATLAS ===');
  const invs = await Inventory.find();
  invs.forEach(i => {
    console.log(`• [${i.itemId}] "${i.name}" -> Qty: ${i.quantity} ${i.unit} (Capacity: ${i.capacity}, Low-Stock Threshold: ${i.lowStockThreshold}, Owner: ${i.ngoId})`);
  });

  console.log('\n=== NOTIFICATIONS FOR PRIYA NAIR IN MONGODB ATLAS ===');
  const notifs = await Notification.find({ userId: ngo._id });
  notifs.forEach(n => {
    console.log(`• [${n.type.toUpperCase()}] "${n.title}": ${n.message} (Recipient ID: ${n.userId})`);
  });

  await mongoose.disconnect();
}

verify().catch(console.error);
