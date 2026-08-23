const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const sosRoutes = require("./routes/sosRoutes");
const rescueCaseRoutes = require("./routes/rescueCaseRoutes");
const campRoutes = require("./routes/campRoutes");
const volunteerTaskRoutes = require("./routes/volunteerTaskRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const distributionRoutes = require("./routes/distributionRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "ResQConnect backend is running",
    });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/rescue-cases", rescueCaseRoutes);
app.use("/api/camps", campRoutes);
app.use("/api/tasks", volunteerTaskRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/distributions", distributionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

// Static frontend file serving
app.use(express.static(path.join(__dirname, "..")));

// 404 Handler for unknown API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({
        success: false,
        message: "An internal server error occurred",
        error: err.message,
    });
});

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB Atlas connected successfully");

        app.listen(PORT, () => {
            console.log(`ResQConnect backend running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });