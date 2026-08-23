require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Camp = require('./models/Camp');
const Distribution = require('./models/Distribution');
const Notification = require('./models/Notification');

async function syncNgoNotifications() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  const ngoUser = await User.findOne({ email: 'ngo@resqconnect.com' });
  const inv = await Inventory.findOne({ itemId: 'INV-2026-1001' });
  const camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });

  // Clean old QA notifications for Priya Nair
  await Notification.deleteMany({ userId: ngoUser._id });

  // 1. Initial Inventory Stock Added notification
  await Notification.create({
    userId: ngoUser._id,
    title: "Inventory Stock Added",
    message: `Added 100 kits of "Emergency Medical First-Aid Kits" to inventory (INV-2026-1001).`,
    type: "success",
    isRead: false,
    relatedType: "Inventory",
    relatedId: inv._id,
    createdAt: new Date(Date.now() - 3600000)
  });

  // 2. First Distribution of 30 kits
  const dist1 = await Distribution.findOne({ distributionId: 'DIST-2026-6319' });
  if (dist1) {
    await Notification.create({
      userId: ngoUser._id,
      title: "Distribution Logged",
      message: `30 kits of "${inv.name}" dispatched to ${camp.name}.`,
      type: "info",
      isRead: false,
      relatedType: "Distribution",
      relatedId: dist1._id,
      createdAt: new Date(Date.now() - 1800000)
    });
  }

  // 3. Second Distribution of 35 kits (Low Stock triggered)
  const dist2 = await Distribution.findOne({ distributionId: 'DIST-2026-8325' });
  if (dist2) {
    await Notification.create({
      userId: ngoUser._id,
      title: "Distribution Logged",
      message: `35 kits of "${inv.name}" dispatched to ${camp.name}.`,
      type: "info",
      isRead: false,
      relatedType: "Distribution",
      relatedId: dist2._id,
      createdAt: new Date(Date.now() - 900000)
    });

    await Notification.create({
      userId: ngoUser._id,
      title: "Low Stock Alert",
      message: `Inventory item "${inv.name}" (${inv.itemId}) is low on stock (${inv.quantity} ${inv.unit} remaining).`,
      type: "warning",
      isRead: false,
      relatedType: "Inventory",
      relatedId: inv._id,
      createdAt: new Date(Date.now() - 800000)
    });
  }

  console.log('--- Current Synced Notifications for Priya Nair ---');
  const notifs = await Notification.find({ userId: ngoUser._id }).sort({ createdAt: -1 });
  notifs.forEach(n => console.log(`• [${n.type.toUpperCase()}] "${n.title}": ${n.message} (Read: ${n.isRead})`));

  await mongoose.disconnect();
}

syncNgoNotifications().catch(console.error);
