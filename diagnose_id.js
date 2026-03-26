import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/opportunity-circle';
const TEST_ID = '69c56862b97ceb66ad19e603';

async function diagnose() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const colInfo of collections) {
      const col = mongoose.connection.db.collection(colInfo.name);
      const doc = await col.findOne({ _id: new mongoose.Types.ObjectId(TEST_ID) });
      if (doc) {
        console.log(`Found ID ${TEST_ID} in collection: ${colInfo.name}`);
        console.log('Document:', JSON.stringify(doc, null, 2));
        process.exit(0);
      }
    }

    console.log(`ID ${TEST_ID} not found in any collection.`);
    process.exit(1);
  } catch (err) {
    console.error('Diagnosis error:', err);
    process.exit(1);
  }
}

diagnose();
