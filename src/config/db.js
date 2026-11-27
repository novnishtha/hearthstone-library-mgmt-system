const mongoose = require('mongoose');

/**
 * Connect to MongoDB using MONGO_URI.
 * Note: Transactions require MongoDB to run as a replica set (e.g., rs0 via Docker).
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

module.exports = connectDB;
