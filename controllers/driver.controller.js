const driverModel = require("../models/driver.model");
const driverService = require("../services/driver.service");
const blackListTokenModel = require("../models/blackListToken.model");
const { validationResult } = require("express-validator");

module.exports.registerDriver = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password, phone, vehicle } = req.body;

    // Check existing driver
    const existingDriver = await driverModel.findOne({
      $or: [{ email }, { "vehicle.registration": vehicle.registration }],
    });
    if (existingDriver) {
      return res.status(400).json({
        message:
          existingDriver.email === email
            ? "Driver already exists with this email"
            : "Vehicle registration already registered",
      });
    }

    // Create driver through service
    const driver = await driverService.createDriver({
      firstname: fullname.firstname,
      lastname: fullname.lastname,
      email,
      password,
      phone,
      vehicleType: vehicle.type,
      maxWeight: vehicle.maxWeight,
      maxVolume: vehicle.maxVolume,
      registration: vehicle.registration,
      vehicleModel: vehicle.vehicleModel,
    });

    // Generate JWT
    const token = driver.generateAuthToken();

    res.status(201).json({
      success: true,
      token,
      driver: {
        _id: driver._id,
        fullname: driver.fullname,
        email: driver.email,
        vehicle: driver.vehicle,
        status: driver.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Driver registration failed",
      error: error.message,
    });
  }
};

module.exports.loginDriver = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find driver with password
    const driver = await driverModel.findOne({ email }).select("+password");
    if (!driver) {
      return res.status(401).json({ message: "Invalid email" });
    }

    // Verify password
    const isMatch = await driver.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate token
    const token = driver.generateAuthToken();

    res.status(200).json({
      success: true,
      token,
      driver: {
        _id: driver._id,
        fullname: driver.fullname,
        vehicle: driver.vehicle,
        status: driver.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

module.exports.getDriverProfile = async (req, res) => {
  res.status(200).json({
    success: true,
    driver: req.driver,
  });
};

module.exports.logoutDriver = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    await blackListTokenModel.create({ token });
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

// Additional Controller Methods
module.exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const updatedDriver = await driverService.updateDriverLocation(
      req.driver._id,
      lat,
      lng
    );
    res.status(200).json({
      success: true,
      location: updatedDriver.location,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Location update failed",
    });
  }
};

module.exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const driver = await driverModel.findByIdAndUpdate(
      req.driver._id,
      { status },
      { new: true }
    );
    res.status(200).json({
      success: true,
      status: driver.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Status update failed",
    });
  }
};
