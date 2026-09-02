const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // If setting custom DNS servers fails, fallback to system default
}

let isConnecting = false;

const connectDB = async () => {
  if (isConnecting) return;
  isConnecting = true;

  const options = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    w: 'majority',
  };

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    isConnecting = false;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    isConnecting = false;
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Reconnecting...');
  if (!isConnecting && mongoose.connection.readyState === 0) {
    connectDB();
  }
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB runtime error: ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully.');
});

module.exports = connectDB;
