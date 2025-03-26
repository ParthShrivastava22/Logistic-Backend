const driverController = require("../controllers/driver.controller");
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authMiddleware = require("../middlewares/auth.middleware");

// Driver Registration
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("fullname.firstname")
      .isLength({ min: 3 })
      .withMessage("First name must be at least 3 characters"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("phone").isMobilePhone().withMessage("Invalid phone number"),
    body("vehicle.type")
      .isIn([
        "3_wheeler",
        "e_rickshaw",
        "mini_truck",
        "delivery_van",
        "tempo_truck",
        "large_truck",
      ])
      .withMessage("Invalid vehicle type"),
    body("vehicle.maxWeight")
      .isFloat({ min: 1 })
      .withMessage("Invalid weight capacity"),
    body("vehicle.maxVolume")
      .isFloat({ min: 1 })
      .withMessage("Invalid volume capacity"),
    body("vehicle.registration")
      .isLength({ min: 5 })
      .withMessage("Registration must be at least 5 characters"),
    body("vehicle.vehicleModel")
      .isLength({ min: 2 })
      .withMessage("Invalid vehicle model"),
  ],
  driverController.registerDriver
);

// Driver Login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  driverController.loginDriver
);

// Authenticated Routes
router.get(
  "/profile",
  authMiddleware.authDriver,
  driverController.getDriverProfile
);
router.get("/logout", authMiddleware.authDriver, driverController.logoutDriver);

// Additional Driver-specific Routes
router.patch(
  "/location",
  [
    authMiddleware.authDriver,
    body("lat").isFloat().withMessage("Invalid latitude"),
    body("lng").isFloat().withMessage("Invalid longitude"),
  ],
  driverController.updateLocation
);

router.patch(
  "/status",
  [
    authMiddleware.authDriver,
    body("status").isIn(["available", "on_delivery", "offline"]),
  ],
  driverController.updateStatus
);

module.exports = router;
