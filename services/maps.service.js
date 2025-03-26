const axios = require("axios");
const driverModel = require("../models/driver.model");

module.exports.getAddressCoordinate = async (address) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "PorterApp (contact@yourdomain.com)", // Required by Nominatim
      },
    });

    if (response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon),
      };
    }
    throw new Error("Address not found");
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error("Could not geocode address");
  }
};

module.exports.getDistanceTime = async (origin, destination) => {
  try {
    // OSM Nominatim URL format: [lon,lat] order
    const url = `http://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full`;

    const response = await axios.get(url);

    if (response.data.routes.length === 0) {
      throw new Error("No route found");
    }

    return {
      distance: response.data.routes[0].distance, // in meters
      duration: response.data.routes[0].duration, // in seconds
    };
  } catch (error) {
    console.error("OSM Routing Error:", error.response?.data || error.message);
    throw new Error("Could not calculate route");
  }
};

module.exports.getAutoCompleteSuggestions = async (input) => {
  // Using MapTiler Cloud autocomplete (free tier available)
  const apiKey = process.env.MAPTILER_KEY;
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
    input
  )}.json?key=${apiKey}`;

  try {
    const response = await axios.get(url);
    return response.data.features.map((feature) => feature.place_name);
  } catch (error) {
    console.error("Autocomplete error:", error);
    return [];
  }
};

module.exports.getDriversInTheRadius = async (lat, lng, radius) => {
  try {
    return await driverModel.find({
      $expr: {
        $lte: [
          {
            $sqrt: {
              $add: [
                { $pow: [{ $subtract: ["$location.lng", lng] }, 2] },
                { $pow: [{ $subtract: ["$location.lat", lat] }, 2] },
              ],
            },
          },
          radius / 111.32, // Approximate 1° ≈ 111.32 km
        ],
      },
      status: "available",
    });
  } catch (error) {
    console.error("Driver search error:", error);
    throw new Error("Could not search drivers");
  }
};
