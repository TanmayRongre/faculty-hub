/**
 * assignBatchesToStudents.js
 *
 * Populates batch A, B, C for the 68 students in MongoDB:
 * - Batch A: Roll 1–24 (24 students)
 * - Batch B: Roll 25–47 (23 students)
 * - Batch C: Roll 48–68 (21 students)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Student = require('../models/Student');

async function assignBatches() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected.');

  const students = await Student.find({ semester: 5, status: 'active' }).lean();
  console.log(`Found ${students.length} active students.`);

  let aCount = 0;
  let bCount = 0;
  let cCount = 0;

  for (const s of students) {
    const roll = Number(s.rollNumber);
    let batch = null;
    if (roll >= 1 && roll <= 24) {
      batch = 'A';
      aCount++;
    } else if (roll >= 25 && roll <= 47) {
      batch = 'B';
      bCount++;
    } else if (roll >= 48 && roll <= 68) {
      batch = 'C';
      cCount++;
    }

    if (batch) {
      await Student.updateOne({ _id: s._id }, { $set: { batch } });
    }
  }

  console.log(`Updated batches:`);
  console.log(`- Batch A (Roll 1–24): ${aCount} students`);
  console.log(`- Batch B (Roll 25–47): ${bCount} students`);
  console.log(`- Batch C (Roll 48–68): ${cCount} students`);
  console.log(`Total: ${aCount + bCount + cCount} students`);

  await mongoose.disconnect();
}

if (require.main === module) {
  assignBatches()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = assignBatches;
