const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const app = express();
const connectToDB = require("./db/db");
const userRoutes = require("./routes/user.routes");
const driverRoutes = require("./routes/driver.routes");
const mapsRoutes = require("./routes/maps.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

connectToDB();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

app.use(cors({
  origin: "https://logimove.netlify.app", // Must match exactly
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/users", userRoutes);
app.use("/drivers", driverRoutes);
app.use("/maps", mapsRoutes);
app.use("/deliveries", deliveryRoutes);

module.exports = app;
