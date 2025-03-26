const Delivery = require("../models/delivery.model");
const deliveryService = require("../services/delivery.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const { sendMessageToSocketId } = require("../socket");

module.exports = {
  createDelivery: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { pickup, dropoff, luggage, paymentMethod, vehicleType } = req.body;

      const parseCoordinates = (coords) => {
        try {
          // Handle both stringified JSON and objects
          const parsed =
            typeof coords === "string" ? JSON.parse(coords) : coords;

          // First try standard lat/lng format
          if (
            typeof parsed.lat === "number" &&
            typeof parsed.lng === "number"
          ) {
            return {
              lat: parsed.lat,
              lng: parsed.lng,
            };
          }

          // Try alternative field names
          if (
            typeof parsed.latitude === "number" &&
            typeof parsed.longitude === "number"
          ) {
            return {
              lat: parsed.latitude,
              lng: parsed.longitude,
            };
          }

          // Handle array format [lng, lat]
          if (Array.isArray(parsed) && parsed.length === 2) {
            return {
              lat: parseFloat(parsed[1]),
              lng: parseFloat(parsed[0]),
            };
          }

          // Handle GeoJSON format
          if (parsed.type === "Point" && Array.isArray(parsed.coordinates)) {
            return {
              lng: parseFloat(parsed.coordinates[0]),
              lat: parseFloat(parsed.coordinates[1]),
            };
          }

          throw new Error("Unsupported coordinate format");
        } catch (error) {
          console.error("Coordinate parsing failed. Received:", coords);
          throw new Error(`Invalid coordinates: ${error.message}`);
        }
      };

      // Usage in controller
      const validatedPickup = {
        address: pickup.address,
        coordinates: parseCoordinates(pickup.coordinates),
      };

      const validatedDropoff = {
        address: dropoff.address,
        coordinates: parseCoordinates(dropoff.coordinates),
      };

      console.log(validatedDropoff, validatedPickup);

      // Validate vehicle type
      if (!deliveryService.vehicleConfig[vehicleType]) {
        return res.status(400).json({ message: "Invalid vehicle type" });
      }

      // Create delivery with parsed coordinates
      const delivery = await deliveryService.createDelivery({
        user: req.user._id,
        pickup: validatedPickup,
        dropoff: validatedDropoff,
        luggage: {
          weight: parseFloat(luggage.weight),
          dimensions: {
            length: parseFloat(luggage.dimensions.length),
            width: parseFloat(luggage.dimensions.width),
            height: parseFloat(luggage.dimensions.height),
          },
          type: luggage.type,
        },
        paymentMethod,
        vehicleType,
      });

      // Get drivers with parsed coordinates
      const drivers = await mapService.getDriversInTheRadius(
        validatedPickup.coordinates.lat,
        validatedPickup.coordinates.lng,
        5
      );

      drivers.forEach((driver) => {
        sendMessageToSocketId(driver.socketId, {
          event: "new-delivery",
          data: delivery,
        });
      });

      res.status(201).json(delivery);
    } catch (err) {
      res.status(400).json({
        message: err.message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    }
  },

  getFareEstimate: async (req, res) => {
    try {
      // Parse coordinates from query strings
      const parseCoordinates = (str) => {
        try {
          const coords = JSON.parse(str);
          return {
            lat: parseFloat(coords.lat),
            lng: parseFloat(coords.lng),
          };
        } catch (error) {
          throw new Error("Invalid coordinates format");
        }
      };

      // Parse all parameters
      const {
        pickup: pickupStr,
        dropoff: dropoffStr,
        weight,
        dimensions: dimensionsStr,
        vehicleType,
      } = req.query;

      // Validate required parameters
      if (!pickupStr || !dropoffStr || !vehicleType || !weight) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Parse coordinates
      const pickup = parseCoordinates(pickupStr);
      const dropoff = parseCoordinates(dropoffStr);

      // Validate coordinate values
      if (isNaN(pickup.lat)) throw new Error("Invalid pickup latitude");
      if (isNaN(pickup.lng)) throw new Error("Invalid pickup longitude");
      if (isNaN(dropoff.lat)) throw new Error("Invalid dropoff latitude");
      if (isNaN(dropoff.lng)) throw new Error("Invalid dropoff longitude");

      // Rest of the calculation
      const volume = dimensionsStr
        ? (JSON.parse(dimensionsStr).length *
            JSON.parse(dimensionsStr).width *
            JSON.parse(dimensionsStr).height) /
          1000000
        : 0;

      const fare = await deliveryService.calculateFare(
        [pickup.lng, pickup.lat], // Note the order: [lng, lat]
        [dropoff.lng, dropoff.lat],
        vehicleType,
        parseFloat(weight),
        volume
      );

      res.status(200).json({ fare });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  assignDriver: async (req, res) => {
    try {
      const delivery = await Delivery.findById(req.body.deliveryId);
      console.log(delivery);

      if (!delivery) {
        return res
          .status(404)
          .json({ success: false, message: "Delivery not found" });
      }

      // Check if delivery is already assigned
      if (delivery.driver) {
        return res.status(400).json({
          success: false,
          message: "Delivery already assigned to another driver",
        });
      }

      delivery.driver = req.driver._id;
      delivery.status = "driver_assigned";
      await delivery.save();

      res.json({
        success: true,
        updatedDelivery: delivery,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  verifyPickup: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { deliveryId, otp } = req.body;
      const delivery = await deliveryService.verifyPickup(deliveryId, otp);

      // Notify user and driver
      sendMessageToSocketId(delivery.user.socketId, {
        event: "pickup-verified",
        data: delivery,
      });

      sendMessageToSocketId(delivery.driver.socketId, {
        event: "pickup-confirmed",
        data: delivery,
      });

      res.status(200).json(delivery);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  updateDeliveryStatus: async (req, res) => {
    try {
      const delivery = await Delivery.findById(req.params.id);
      if (!delivery)
        return res.status(404).json({ error: "Delivery not found" });

      // Validate driver ownership
      if (delivery.driver.toString() !== req.driver.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Validate status transitions
      const validTransitions = {
        pending: ["driver_assigned"],
        driver_assigned: ["picked_up"],
        picked_up: ["in_transit"],
        in_transit: ["delivered"],
        delivered: [],
        cancelled: [],
      };

      if (!validTransitions[delivery.status].includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status transition" });
      }

      delivery.status = req.body.status;
      delivery.updatedAt = Date.now();

      // Update timestamps
      if (req.body.status === "picked_up")
        delivery.actualPickupTime = Date.now();
      if (req.body.status === "delivered")
        delivery.actualDeliveryTime = Date.now();

      await delivery.save();

      // Emit socket event
      const io = req.app.get("socketio");
      io.to(`delivery_${delivery.id}`).emit("delivery_updated", delivery);

      res.json(delivery);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },

  cancelDelivery: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { deliveryId } = req.body;
      const delivery = await deliveryService.cancelDelivery(deliveryId);

      // Notify all parties
      sendMessageToSocketId(delivery.user.socketId, {
        event: "delivery-cancelled",
        data: delivery,
      });

      if (delivery.driver) {
        sendMessageToSocketId(delivery.driver.socketId, {
          event: "delivery-cancelled",
          data: delivery,
        });
      }

      res.status(200).json(delivery);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  getUserDeliveries: async (req, res) => {
    try {
      const deliveries = await deliveryService.getUserDeliveries(req.user._id);
      res.status(200).json(deliveries);
    } catch (error) {
      res.status(500).json({
        message: error.message || "Failed to fetch deliveries",
      });
    }
  },

  getNearbyDeliveries: async (req, res) => {
    try {
      const deliveries = await deliveryService.getNearbyDeliveries(
        req.query.lng,
        req.query.lat,
        req.query.maxDistance,
        req.query.vehicleType
      );
      res.json(deliveries);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  },

  getAssignedDeliveries: async (req, res) => {
    try {
      const deliveries = await deliveryService.getAssignedDelivery(
        req.driver._id
      );
      res.status(200).json(deliveries);
    } catch (error) {
      res.status(500).json({
        message: error.message || "Failed to fetch deliveries",
      });
    }
  },

  getDeliveryById: async (req, res) => {
    try {
      const delivery = await deliveryService.getDeliveryById(req.params.id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      // Authorization check
      const isUser = req.user && delivery.user._id.equals(req.user._id);
      const isDriver =
        req.driver && delivery.driver?._id.equals(req.driver._id);

      if (!isUser && !isDriver) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // Prepare response
      const response = delivery.toObject();

      // Hide sensitive fields based on requester type
      if (!isDriver) {
        delete response.otp;
        delete response.driver?.vehicle?.registration;
      }

      res.json(response);
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
};
