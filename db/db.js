// db.js (demo mode using mongodb-memory-server)
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

async function connectToDb() {
  if (process.env.DEMO_MODE === "true") {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory MongoDB (demo mode)");
  } else {
    await mongoose.connect(process.env.DB_CONNECT);
    console.log("Connected to DB");
  }
}

module.exports = connectToDb;
