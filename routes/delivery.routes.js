require("../models/driver.model");
const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const deliveryController = require("../controllers/delivery.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Show deliveries
router.get("/", authMiddleware.authUser, deliveryController.getUserDeliveries);

// Driver Assigned Deliveries
router.get(
  "/assigned",
  authMiddleware.authDriver,
  deliveryController.getAssignedDeliveries
);

// Create a delivery request
router.post(
  "/create",
  authMiddleware.authUser,
  body("pickup").isObject().withMessage("Invalid pickup location"),
  body("dropoff").isObject().withMessage("Invalid dropoff location"),
  body("luggage").exists().withMessage("Luggage details are required"),
  body("paymentMethod").isString().withMessage("Invalid payment method"),
  body("vehicleType").isString().withMessage("Invalid vehicle type"),
  deliveryController.createDelivery
);

// Get fare estimate for a delivery
router.get(
  "/get-fare-estimate",
  authMiddleware.authUser,
  query("pickup").isObject().withMessage("Invalid pickup coordinates"),
  query("dropoff").isObject().withMessage("Invalid dropoff coordinates"),
  query("weight").isNumeric().withMessage("Invalid weight"),
  query("dimensions").exists().withMessage("Dimensions are required"),
  query("vehicleType").isString().withMessage("Invalid vehicle type"),
  deliveryController.getFareEstimate
);

// Assign a driver to a delivery (requires driver authentication)
router.post(
  "/assign-driver",
  authMiddleware.authDriver,
  body("deliveryId").isMongoId().withMessage("Invalid delivery id"),
  deliveryController.assignDriver
);

// Verify pickup by checking OTP
router.post(
  "/verify-pickup",
  authMiddleware.authUser,
  body("deliveryId").isMongoId().withMessage("Invalid delivery id"),
  body("otp")
    .isString()
    .isLength({ min: 6, max: 6 })
    .withMessage("Invalid OTP"),
  deliveryController.verifyPickup
);

// Update delivery status (e.g., in_transit, delivered)
router.patch(
  "/:id/status",
  authMiddleware.authDriver,
  deliveryController.updateDeliveryStatus
);

// Cancel a delivery
router.post(
  "/cancel-delivery",
  authMiddleware.authUser,
  body("deliveryId").isMongoId().withMessage("Invalid delivery id"),
  deliveryController.cancelDelivery
);

// Get nearby deliveries
router.get(
  "/nearby",
  authMiddleware.authDriver,
  query("lat").isFloat().withMessage("Invalid latitude"),
  query("lng").isFloat().withMessage("Invalid longitude"),
  query("maxDistance").isInt({ min: 1000 }).withMessage("Invalid distance"),
  query("vehicleType").isString().withMessage("Invalid vehicle type"),
  deliveryController.getNearbyDeliveries
);

// Get single delivery by ID
router.get(
  "/:id",
  authMiddleware.authDeliveryAccess, // Use appropriate auth middleware
  deliveryController.getDeliveryById
);

module.exports = router;
