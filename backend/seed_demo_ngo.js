require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Camp = require('./models/Camp');
const Inventory = require('./models/Inventory');

async function seedNgoData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB Atlas.\n');

  // 1. Seed / Update Demo NGO User
  const email = 'ngo@resqconnect.com';
  const name = 'Priya Nair';
  const password = 'Ngo12345';
  const role = 'ngo';
  const phone = '9876543333';

  let ngoUser = await User.findOne({ email });
  if (!ngoUser) {
    ngoUser = await User.create({
      name,
      email,
      password,
      role,
      phone,
      status: 'active',
      isActive: true
    });
    console.log(`✔ Permanent Demo NGO User Created: ${ngoUser.name} (${ngoUser.email}) [ID: ${ngoUser._id}]`);
  } else {
    ngoUser.name = name;
    ngoUser.password = password;
    ngoUser.role = role;
    ngoUser.phone = phone;
    ngoUser.status = 'active';
    ngoUser.isActive = true;
    await ngoUser.save();
    console.log(`✔ Permanent Demo NGO User Updated: ${ngoUser.name} (${ngoUser.email}) [ID: ${ngoUser._id}]`);
  }

  // 2. Ensure Relief Camp Exists for Distribution Testing
  let camp = await Camp.findOne({ name: 'Ghatkopar Central Relief Center' });
  if (!camp) {
    camp = await Camp.create({
      name: 'Ghatkopar Central Relief Center',
      location: 'Ghatkopar, Mumbai',
      capacity: 500,
      occupancy: 120,
      status: 'active'
    });
    console.log(`✔ Relief Camp Created: ${camp.name}`);
  } else {
    console.log(`✔ Relief Camp Verified: ${camp.name}`);
  }

  // 3. Ensure Base Demo Inventory Item Exists with 100 Kits
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
    console.log(`✔ Demo Inventory Item Created: ${item.itemId} - "${item.name}" (Qty: ${item.quantity} ${item.unit})`);
  } else {
    item.quantity = 100;
    item.capacity = 100;
    item.lowStockThreshold = 40;
    item.ngoId = ngoUser._id;
    await item.save();
    console.log(`✔ Demo Inventory Item Verified & Reset: ${item.itemId} - "${item.name}" (Qty: ${item.quantity} ${item.unit})`);
  }

  await mongoose.disconnect();
}

seedNgoData().catch(err => {
  console.error('Error seeding demo NGO data:', err);
  process.exit(1);
});
