const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const blackListTokenModel = require("../models/blackListToken.model");
const driverModel = require("../models/driver.model");

module.exports.authUser = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const isBlacklisted = await blackListTokenModel.findOne({ token: token });

  if (isBlacklisted) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded._id);

    // Add role check
    if (decoded.role && decoded.role !== "user") {
      return res.status(403).json({ message: "User access required" });
    }

    req.user = user;

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports.authDriver = async (req, res, next) => {
  try {
    // Get token from headers (preferred for APIs) or cookies
    const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    // Check token blacklist
    const blacklisted = await blackListTokenModel.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: "Session expired - please login again",
      });
    }

    // Verify with shared secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Additional driver-specific check
    if (decoded.role !== "driver") {
      return res.status(403).json({ message: "Driver access required" });
    }

    const driver = await driverModel.findById(decoded._id);

    if (!driver) {
      return res.status(404).json({ message: "Driver account not found" });
    }

    req.driver = driver;
    next();
  } catch (error) {
    // Handle different error types
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired - please login again"
        : "Invalid authentication token";

    res.status(401).json({
      success: false,
      message,
    });
  }
};

module.exports.authDeliveryAccess = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    // Try user auth first
    const userDecoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(userDecoded._id);
    if (user) {
      req.user = user;
      return next();
    }
  } catch (userError) {
    // Proceed to driver check
  }

  try {
    // Try driver auth next
    const driverDecoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(driverDecoded);
    const driver = await driverModel.findById(driverDecoded._id);
    if (driver) {
      req.driver = driver;
      return next();
    }
  } catch (driverError) {
    return res.status(401).json({ message: "Invalid token" });
  }

  res.status(401).json({ message: "Authentication failed" });
};
