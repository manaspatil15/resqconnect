const mongoose = require("mongoose");

const volunteerTaskSchema = new mongoose.Schema(
    {
        taskId: {
            type: String,
            required: true,
            unique: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
        },

        volunteerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        location: {
            type: String,
            required: true,
            trim: true,
        },

        priority: {
            type: String,
            enum: ["critical", "high", "medium", "low"],
            default: "medium",
        },

        status: {
            type: String,
            enum: ["available", "accepted", "in_progress", "completed"],
            default: "available",
        },

        dueDate: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("VolunteerTask", volunteerTaskSchema);