const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        reportId: {
            type: String,
            required: true,
            unique: true,
        },

        citizenId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        type: {
            type: String,
            required: true,
            trim: true,
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

        location: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: ["pending", "verified", "rejected", "reported", "investigating", "found", "closed"],
            default: "pending",
        },

        // Missing Person Specific Fields
        personName: {
            type: String,
            trim: true,
            default: null,
        },

        age: {
            type: Number,
            default: null,
        },

        gender: {
            type: String,
            enum: ["Male", "Female", "Other", "Unknown"],
            default: null,
        },

        lastSeenLocation: {
            type: String,
            trim: true,
            default: null,
        },

        lastSeenAt: {
            type: Date,
            default: null,
        },

        photo: {
            type: String,
            default: null,
        },

        contactName: {
            type: String,
            trim: true,
            default: null,
        },

        contactPhone: {
            type: String,
            trim: true,
            default: null,
        },

        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Report", reportSchema);