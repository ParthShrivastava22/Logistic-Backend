// Load models FIRST
require("../models/user.model"); // Import User model
require("../models/driver.model"); // Import Driver model if needed
require("../models/delivery.model");

const mongoose = require("mongoose");

function connectToDb() {
  mongoose
    .connect(process.env.DB_CONNECT)
    .then(() => {
      console.log("Connected to DB");
    })
    .catch((err) => console.log(err));
}

module.exports = connectToDb;
