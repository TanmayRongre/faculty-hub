require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function inspect() {
  const uri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  const dns = require('dns');
  try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e) {}
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('\n=== PRE-RESET INSPECTION ===');
  console.log('Database:', db.databaseName);
  console.log('Total collections:', collections.length, '\n');
  let totalDocs = 0;
  for (const col of collections.sort((a,b) => a.name.localeCompare(b.name))) {
    const count = await db.collection(col.name).countDocuments();
    totalDocs += count;
    console.log(` ${col.name.padEnd(25)} : ${count} documents`);
  }
  console.log('\nTotal documents:', totalDocs);
  await mongoose.disconnect();
}

inspect().catch(err => { console.error(err); process.exit(1); });
