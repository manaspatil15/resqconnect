const mongoose = require("mongoose");

const rescueCaseSchema = new mongoose.Schema(
    {
        caseId: {
            type: String,
            required: true,
            unique: true,
        },

        sosId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SOS",
            default: null,
        },

        citizenId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        assignedTo: {
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
            default: "high",
        },

        status: {
            type: String,
            enum: ["pending", "assigned", "in_progress", "resolved"],
            default: "pending",
        },

        responseTime: {
            type: Number,
            default: null,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("RescueCase", rescueCaseSchema);