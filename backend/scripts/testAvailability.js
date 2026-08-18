const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const email = 'vedantst6@gmail.com';
  const user = await User.findOne({ email });
  
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h', issuer: 'hackhive-scheduler', audience: 'hackhive-client', algorithm: 'HS256' }
  );
  
  // Reset
  await mongoose.connection.db.collection('users').updateOne(
    { email }, { $set: { availabilityConfig: null } }
  );
  console.log('1. Reset done');
  
  // Save via HTTP
  const testConfig = [
    { name: 'Monday', active: true, slots: [{ from: '11:00', to: '15:00' }] },
    { name: 'Tuesday', active: false, slots: [] },
    { name: 'Wednesday', active: true, slots: [{ from: '08:00', to: '12:00' }] },
    { name: 'Thursday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
    { name: 'Friday', active: true, slots: [{ from: '09:00', to: '17:00' }] },
    { name: 'Saturday', active: false, slots: [] },
    { name: 'Sunday', active: false, slots: [] },
  ];

  const saveRes = await fetch('http://localhost:5000/api/v1/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ availabilityConfig: testConfig }),
  });
  const saveText = await saveRes.text();
  console.log('2. PUT status:', saveRes.status);
  console.log('2. PUT body:', saveText.substring(0, 500));
  
  // Check DB
  const dbUser = await User.findOne({ email });
  console.log('3. DB config:', dbUser.availabilityConfig ? 'EXISTS' : 'NULL');
  if (dbUser.availabilityConfig) {
    console.log('   Mon:', JSON.stringify(dbUser.availabilityConfig[0]));
  }
  
  process.exit(0);
}

test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
