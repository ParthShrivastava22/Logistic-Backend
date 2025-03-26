const driverModel = require("../models/driver.model");
const bcrypt = require("bcrypt");

module.exports.createDriver = async ({
  firstname,
  lastname,
  email,
  password,
  phone,
  vehicleType,
  maxWeight,
  maxVolume,
  registration,
  vehicleModel,
}) => {
  // Validate required fields
  const requiredFields = [
    firstname,
    email,
    password,
    phone,
    vehicleType,
    maxWeight,
    maxVolume,
    registration,
    vehicleModel,
  ];

  if (requiredFields.some((field) => !field)) {
    throw new Error("All required fields must be provided");
  }

  // Hash password before storage
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create driver document
  const driver = await driverModel.create({
    fullname: {
      firstname: firstname.trim(),
      lastname: lastname?.trim() || "",
    },
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    phone: phone.replace(/[^\d]/g, ""), // Sanitize phone number
    vehicle: {
      type: vehicleType,
      maxWeight: Number(maxWeight),
      maxVolume: Number(maxVolume),
      registration: registration.toUpperCase().trim(),
      vehicleModel: vehicleModel.trim(),
    },
  });

  return driver;
};

// Additional Service Methods
module.exports.updateDriverLocation = async (driverId, lat, lng) => {
  return driverModel.findByIdAndUpdate(
    driverId,
    {
      $set: {
        "location.lat": lat,
        "location.lng": lng,
      },
    },
    { new: true }
  );
};

module.exports.findAvailableDrivers = async (weight, volume) => {
  return driverModel.find({
    status: "available",
    isVerified: true,
    "vehicle.maxWeight": { $gte: weight },
    "vehicle.maxVolume": { $gte: volume },
  });
};
