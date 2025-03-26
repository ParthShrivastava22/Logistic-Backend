const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },
    pickup: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    dropoff: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    luggage: {
      weight: {
        type: Number, // in kilograms
        required: true,
      },
      dimensions: {
        // in centimeters
        length: Number,
        width: Number,
        height: Number,
      },
      type: {
        type: String,
        enum: ["boxes", "furniture", "electronics", "documents", "other"],
        required: true,
      },
      photos: [String], // Array of image URLs
    },
    fare: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "scheduled",
        "driver_assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    scheduledPickup: Date,
    scheduledDelivery: Date,
    actualPickupTime: Date,
    actualDeliveryTime: Date,
    distance: {
      // in kilometers
      type: Number,
      required: true,
    },
    duration: {
      // in minutes
      type: Number,
      required: true,
    },
    payment: {
      method: {
        type: String,
        enum: ["cash", "online", "wallet"],
        required: true,
      },
      transactionId: String,
      status: {
        type: String,
        enum: ["pending", "completed", "refunded"],
        default: "pending",
      },
    },
    otp: {
      type: String,
      select: false,
      required: true,
    },
    specialInstructions: String,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// In delivery.model.js
deliverySchema.pre(/^find/, function (next) {
  this.populate({
    path: "driver",
    select: "name vehicle phone",
  });
  next();
});

// Indexes for geospatial queries
deliverySchema.index({ "pickup.coordinates": "2dsphere" });
deliverySchema.index({ "dropoff.coordinates": "2dsphere" });
deliverySchema.index({ user: 1, createdAt: -1 }); // For user deliveries query

module.exports = mongoose.model("Delivery", deliverySchema);
