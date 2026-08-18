const mongoose = require('mongoose');
require('dotenv').config();

async function fixRoles() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Fix all users with invalid role "user" → "member"
  const result = await mongoose.connection.db
    .collection('users')
    .updateMany({ role: 'user' }, { $set: { role: 'member' } });
  
  console.log(`Fixed ${result.modifiedCount} users with invalid role "user" → "member"`);
  
  // Verify
  const remaining = await mongoose.connection.db
    .collection('users')
    .countDocuments({ role: { $nin: ['member', 'host', 'admin'] } });
  console.log(`Remaining invalid roles: ${remaining}`);
  
  process.exit(0);
}

fixRoles();
