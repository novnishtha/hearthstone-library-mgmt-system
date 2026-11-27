const mongoose = require('mongoose');

let cachedPromise = null;

/**
 * Connect to MongoDB using MONGO_URI (cached for serverless reuse).
 * Note: Transactions require MongoDB to run as a replica set (e.g., rs0 or Atlas).
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  if (!cachedPromise) {
    cachedPromise = mongoose.connect(uri).then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    });
  }

  return cachedPromise;
}

module.exports = connectDB;
