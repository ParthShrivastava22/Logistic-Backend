const mapService = require("../services/maps.service");
const { validationResult } = require("express-validator");

/**
 * Get coordinates for a given address using OSM Nominatim.
 * Expects: ?address=Some+Address in the query string.
 */
exports.getCoordinates = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    const coordinates = await mapService.getAddressCoordinate(address);
    return res.status(200).json(coordinates);
  } catch (error) {
    console.error("Error fetching coordinates:", error);
    return res.status(404).json({ message: "Coordinates not found" });
  }
};

/**
 * Get distance and travel time between two points using OSRM.
 * Expects: ?origin=lng,lat&destination=lng,lat in the query string.
 */
exports.getDistanceTime = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res
      .status(400)
      .json({ error: "Origin and destination are required" });
  }

  // Parse origin and destination from comma-separated strings into arrays of numbers
  const originCoords = origin.split(",").map(Number);
  const destinationCoords = destination.split(",").map(Number);

  try {
    const distanceTime = await mapService.getDistanceTime(
      originCoords,
      destinationCoords
    );
    return res.status(200).json(distanceTime);
  } catch (err) {
    console.error("Error fetching distance and time:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get auto-complete suggestions for a query using MapTiler Cloud.
 * Expects: ?input=Some+Query in the query string.
 */
exports.getAutoCompleteSuggestions = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { input } = req.query;
  if (!input) {
    return res.status(400).json({ error: "Input query is required" });
  }

  try {
    const suggestions = await mapService.getAutoCompleteSuggestions(input);
    return res.status(200).json(suggestions);
  } catch (err) {
    console.error("Error fetching autocomplete suggestions:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get drivers (porters) available within a given radius.
 * Expects: ?lat=...&lng=...&radius=... in the query string.
 */
exports.getDriversInRadius = async (req, res, next) => {
  const { lat, lng, radius } = req.query;
  if (lat === undefined || lng === undefined || !radius) {
    return res
      .status(400)
      .json({ error: "Latitude, longitude, and radius are required" });
  }

  try {
    const drivers = await mapService.getDriversInTheRadius(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius)
    );
    console.log(drivers);
    return res.status(200).json({ drivers });
  } catch (err) {
    console.error("Error fetching drivers in radius:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
