require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Distribution = require('./models/Distribution');
const Camp = require('./models/Camp');
const Notification = require('./models/Notification');

async function resetNgoDemoData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // 1. Find / Ensure Priya Nair (ngo@resqconnect.com)
  const ngoUser = await User.findOne({ email: 'ngo@resqconnect.com' });
  if (!ngoUser) {
    throw new Error('NGO user ngo@resqconnect.com not found');
  }
  console.log(`✔ Found NGO User: ${ngoUser.name} (${ngoUser.email}) [ID: ${ngoUser._id}]`);

  // 2. Ensure Relief Camp
  let camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });
  if (!camp) {
    camp = await Camp.create({
      name: 'Ghatkopar Central Relief Center',
      location: 'Ghatkopar, Mumbai',
      capacity: 500,
      occupancy: 120,
      status: 'active'
    });
  }

  // 3. Remove any old duplicate items named 'Emergency Medical First-Aid Kits' whose itemId is NOT 'INV-2026-1001'
  const delDups = await Inventory.deleteMany({
    name: 'Emergency Medical First-Aid Kits',
    itemId: { $ne: 'INV-2026-1001' }
  });
  if (delDups.deletedCount > 0) {
    console.log(`✔ Cleaned up ${delDups.deletedCount} duplicate "Emergency Medical First-Aid Kits" record(s).`);
  }

  // 4. Reset/Update Demo Inventory Item: INV-2026-1001
  let item = await Inventory.findOne({ itemId: 'INV-2026-1001' });
  if (!item) {
    item = await Inventory.create({
      itemId: 'INV-2026-1001',
      name: 'Emergency Medical First-Aid Kits',
      category: 'Medical Aid',
      quantity: 100,
      capacity: 100,
      unit: 'kits',
      lowStockThreshold: 40,
      ngoId: ngoUser._id
    });
    console.log(`✔ Created Demo Inventory Item: ${item.itemId} (100 kits)`);
  } else {
    item.name = 'Emergency Medical First-Aid Kits';
    item.quantity = 100;
    item.capacity = 100;
    item.unit = 'kits';
    item.lowStockThreshold = 40;
    item.ngoId = ngoUser._id;
    await item.save();
    console.log(`✔ Reset Demo Inventory Item: ${item.itemId} to 100 kits (Capacity: 100, Low-stock threshold: 40)`);
  }

  // 5. Remove previous distribution records associated with this demo item
  const delDist = await Distribution.deleteMany({ inventoryId: item._id });
  console.log(`✔ Removed ${delDist.deletedCount} previous distribution record(s) for ${item.itemId} to start cleanly at 100 kits.`);

  // 6. Clean up old notifications for this NGO and create fresh Inventory Stock Added notification
  await Notification.deleteMany({ userId: ngoUser._id });
  const notif = await Notification.create({
    userId: ngoUser._id,
    title: "Inventory Stock Added",
    message: `Added 100 kits of "${item.name}" to inventory (${item.itemId}).`,
    type: "success",
    isRead: false,
    relatedType: "Inventory",
    relatedId: item._id
  });
  console.log(`✔ Seeded Fresh Notification for Priya Nair: "${notif.title}" - "${notif.message}"`);

  console.log('\n--- Current Inventory in MongoDB Atlas ---');
  const allInv = await Inventory.find();
  allInv.forEach(i => console.log(`• [${i.itemId}] ${i.name} -> ${i.quantity} ${i.unit} (Owner: ${i.ngoId})`));

  console.log('\n--- Current Notifications for Priya Nair ---');
  const notifs = await Notification.find({ userId: ngoUser._id });
  notifs.forEach(n => console.log(`• [${n.type}] ${n.title}: "${n.message}"`));

  await mongoose.disconnect();
}

resetNgoDemoData().catch(err => {
  console.error('Error resetting NGO demo data:', err);
  process.exit(1);
});
