require("../models/user.model");
require("../models/driver.model");
const Delivery = require("../models/delivery.model");
const mapService = require("./maps.service");
const crypto = require("crypto");
const mongoose = require("mongoose");

// Added: Vehicle configuration (new code)
const vehicleConfig = {
  "3_wheeler": { base: 50, perKm: 15, perKg: 2, maxWeight: 500 },
  e_rickshaw: { base: 40, perKm: 12, perKg: 1.5, maxWeight: 300 },
  mini_truck: { base: 100, perKm: 25, perKg: 5, maxWeight: 1500 },
  delivery_van: { base: 80, perKm: 20, perKg: 4, maxWeight: 1000 },
  tempo_truck: { base: 150, perKm: 35, perKg: 8, maxWeight: 4000 },
  large_truck: { base: 250, perKm: 50, perKg: 12, maxWeight: 10000 },
};

// Modified: Fare calculation with new validation (existing parameters kept)
async function calculateFare(
  pickupCoords,
  dropoffCoords,
  vehicleType,
  weight,
  volume
) {
  // Added validation
  if (!vehicleConfig[vehicleType]) {
    throw new Error(`Invalid vehicle type: ${vehicleType}`);
  }

  // Original map service call kept
  const routeDetails = await mapService.getDistanceTime(
    pickupCoords,
    dropoffCoords
  );

  // New calculation using vehicle config
  const rates = vehicleConfig[vehicleType];
  const distanceKm = routeDetails.distance / 1000;

  // Preserved original calculation structure
  return Math.round(
    rates.base + distanceKm * rates.perKm + weight * rates.perKg + volume * 0.5 // Original volume concept kept
  );
}

async function createDelivery({
  user,
  pickup,
  dropoff,
  luggage,
  paymentMethod,
  vehicleType,
}) {
  // 1. Calculate route details first
  const [fare, routeDetails] = await Promise.all([
    calculateFare(
      [pickup.coordinates.lng, pickup.coordinates.lat],
      [dropoff.coordinates.lng, dropoff.coordinates.lat],
      vehicleType,
      luggage.weight,
      (luggage.dimensions.length *
        luggage.dimensions.width *
        luggage.dimensions.height) /
        1000000
    ),
    mapService.getDistanceTime(
      [pickup.coordinates.lng, pickup.coordinates.lat],
      [dropoff.coordinates.lng, dropoff.coordinates.lat]
    ),
  ]);

  // 2. Create delivery with all required fields
  return Delivery.create({
    user,
    pickup,
    dropoff,
    luggage,
    fare,
    distance: routeDetails.distance, // in meters
    duration: routeDetails.duration, // in seconds
    otp: generateOTP(),
    payment: { method: paymentMethod },
    status: paymentMethod === "online" ? "scheduled" : "pending_payment",
    vehicleType,
  });
}

// All original functions preserved unchanged below
function generateOTP(length = 6) {
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
}

async function assignDriver(deliveryId, driverId) {
  return Delivery.findByIdAndUpdate(
    deliveryId,
    {
      driver: driverId,
      status: "driver_assigned",
    },
    { new: true }
  ).populate("driver");
}

async function verifyPickup(deliveryId, otp) {
  const delivery = await Delivery.findById(deliveryId).select("+otp");

  if (delivery.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  return Delivery.findByIdAndUpdate(
    deliveryId,
    {
      status: "picked_up",
      actualPickupTime: new Date(),
    },
    { new: true }
  );
}

async function updateDeliveryStatus(deliveryId, newStatus) {
  const validTransitions = {
    picked_up: ["in_transit"],
    in_transit: ["delivered"],
    delivered: [],
  };

  const delivery = await Delivery.findById(deliveryId);

  if (!validTransitions[delivery.status].includes(newStatus)) {
    throw new Error("Invalid status transition");
  }

  const update = { status: newStatus };
  if (newStatus === "delivered") {
    update.actualDeliveryTime = new Date();
  }

  return Delivery.findByIdAndUpdate(deliveryId, update, { new: true });
}

async function handleScheduledDelivery(deliveryId) {
  return Delivery.findByIdAndUpdate(
    deliveryId,
    { status: "driver_assigned" },
    { new: true }
  );
}

async function cancelDelivery(deliveryId) {
  return Delivery.findByIdAndUpdate(
    deliveryId,
    { status: "cancelled" },
    { new: true }
  );
}

async function getUserDeliveries(userId) {
  try {
    return await Delivery.find({ user: userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(10) // Last 10 deliveries // Exclude sensitive/unnecessary fields
      .populate("driver", "name vehicle")
      .lean();
  } catch (error) {
    console.error("Failed to fetch user deliveries:", error);
    throw new Error("Database query failed");
  }
}

async function getNearbyDeliveries(lng, lat, maxDistance, vehicleType) {
  // Convert input parameters to numbers
  const searchLng = parseFloat(lng);
  const searchLat = parseFloat(lat);
  const maxDist = parseFloat(maxDistance);

  return Delivery.aggregate([
    {
      $match: {
        status: "scheduled",
        // Ensure we only process documents with valid coordinates
        "pickup.coordinates.lat": {
          $exists: true,
          $type: ["number", "string"],
        },
        "pickup.coordinates.lng": {
          $exists: true,
          $type: ["number", "string"],
        },
      },
    },
    {
      $addFields: {
        // Convert coordinate fields to numbers
        convertedLat: {
          $cond: {
            if: { $eq: [{ $type: "$pickup.coordinates.lat" }, "string"] },
            then: { $toDouble: "$pickup.coordinates.lat" },
            else: "$pickup.coordinates.lat",
          },
        },
        convertedLng: {
          $cond: {
            if: { $eq: [{ $type: "$pickup.coordinates.lng" }, "string"] },
            then: { $toDouble: "$pickup.coordinates.lng" },
            else: "$pickup.coordinates.lng",
          },
        },
      },
    },
    {
      $match: {
        convertedLat: { $type: "number", $ne: null },
        convertedLng: { $type: "number", $ne: null },
      },
    },
    {
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              {
                $multiply: [
                  { $subtract: ["$convertedLat", searchLat] },
                  { $subtract: ["$convertedLat", searchLat] },
                  111320 * 111320, // Convert lat degrees to meters squared
                ],
              },
              {
                $multiply: [
                  { $subtract: ["$convertedLng", searchLng] },
                  { $subtract: ["$convertedLng", searchLng] },
                  111320 *
                    111320 *
                    Math.pow(Math.cos((searchLat * Math.PI) / 180), 2),
                ],
              },
            ],
          },
        },
      },
    },
    {
      $match: {
        distance: { $lte: maxDist },
      },
    },
    {
      $sort: { distance: 1 },
    },
    {
      $project: {
        convertedLat: 0,
        convertedLng: 0,
      },
    },
  ]);
}

async function getDeliveryById(id) {
  // Validate MongoDB ID
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid delivery ID" });
  }

  // Find delivery
  const delivery = await Delivery.findById(id);
  console.log(delivery);
  return delivery;
}

async function getAssignedDelivery(driverId) {
  return await Delivery.find({ driver: driverId });
}

// Export everything with calculateFare added
module.exports = {
  calculateFare,
  createDelivery,
  assignDriver,
  verifyPickup,
  updateDeliveryStatus,
  handleScheduledDelivery,
  cancelDelivery,
  generateOTP,
  getUserDeliveries,
  getNearbyDeliveries,
  getDeliveryById,
  getAssignedDelivery,
};

// Add this line to expose vehicle config
module.exports.vehicleConfig = vehicleConfig;
