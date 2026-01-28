const mongoose = require('mongoose');

// Connection state tracking
let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection');
    return mongoose.connection;
  }

  // If connection is in progress, return the promise
  if (connectionPromise) {
    console.log('🔄 MongoDB connection in progress...');
    return connectionPromise;
  }

  // Create new connection promise
  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/optometry_db_test';
      
      console.log('🔄 Attempting MongoDB connection...');
      
      const conn = await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // Increased to 10 seconds
        socketTimeoutMS: 45000,
        maxPoolSize: 15,
        minPoolSize: 5,
        retryWrites: true,
        w: 'majority',
        retryReads: true,
      });

      isConnected = true;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database: ${conn.connection.name}`);
      
      resolve(conn.connection);
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      isConnected = false;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🔄 Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
  isConnected = false;
  connectionPromise = null;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
  isConnected = false;
  connectionPromise = null;
});

// Health check function
const checkConnection = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Ping the database to ensure connection is alive
      await mongoose.connection.db.admin().ping();
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

// Wait for connection function
const waitForConnection = async (maxWaitTime = 10000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    if (await checkConnection()) {
      return true;
    }
    // Wait for 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Database connection timeout');
};

module.exports = { 
  connectDB, 
  checkConnection, 
  waitForConnection,
  isConnected: () => isConnected 
};