const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const driverSchema = new mongoose.Schema({
  fullname: {
    firstname: { type: String, required: true, minlength: 3 },
    lastname: { type: String, minlength: 3 },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+$/, "Invalid email"],
  },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true }, // Added for logistics contact
  socketId: { type: String },
  status: {
    type: String,
    enum: ["available", "on_delivery", "offline"],
    default: "offline",
  },
  vehicle: {
    type: {
      type: String,
      required: true,
      enum: [
        "3_wheeler", // e.g., auto-rickshaw loader
        "e_rickshaw", // Electric rickshaw loader
        "mini_truck", // e.g., Tata Ace
        "delivery_van", // Mahindra Supro
        "tempo_truck", // Medium cargo truck
        "large_truck", // Heavy-duty truck
      ],
    },
    maxWeight: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          const limits = {
            "3_wheeler": 500,
            e_rickshaw: 300,
            mini_truck: 1500,
            delivery_van: 1000,
            tempo_truck: 4000,
            large_truck: 10000,
          };
          return value <= limits[this.parent().vehicle.type]; // Correct reference
        },
        message: "Exceeds {VALUE}kg for selected vehicle type",
      },
    },
    maxVolume: {
      // In cubic feet (LxBxH)
      type: Number,
      required: true,
    },
    registration: {
      type: String,
      required: true,
      unique: true,
    },
    vehicleModel: {
      // e.g., "Mahindra Jeeto"
      type: String,
      required: true,
    },
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isVerified: {
    // Admin approval for drivers
    type: Boolean,
    default: false,
  },
});

// Keep the auth methods same as before
driverSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: "driver", // Add role claim
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};
driverSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};
driverSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 10);
};

// In your driver.model.js
driverSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("Driver", driverSchema);
