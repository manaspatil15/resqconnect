const mongoose = require("mongoose");

const sosSchema = new mongoose.Schema(
    {
        referenceNumber: {
            type: String,
            required: true,
            unique: true,
        },

        citizenId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        location: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
        },

        priority: {
            type: String,
            enum: ["critical", "high", "medium", "low"],
            default: "critical",
        },

        status: {
            type: String,
            enum: ["pending", "assigned", "in_progress", "resolved"],
            default: "pending",
        },

        linkedRescueCaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RescueCase",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("SOS", sosSchema);