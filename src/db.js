const mongoose = require("mongoose");

async function connectDB(uri) {
  await mongoose.connect(uri);
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
