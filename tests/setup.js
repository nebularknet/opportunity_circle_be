import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Ensure we load the test environment before anything else
dotenv.config({ path: './.env.test' });

before(async function () {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

// Global hook to reset the database before each test
beforeEach(async function () {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    const promises = Object.keys(collections).map((key) => 
      collections[key].deleteMany({})
    );
    await Promise.all(promises);
  }
});

// Optional: Global teardown to close connection
after(async function () {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
