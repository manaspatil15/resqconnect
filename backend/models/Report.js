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
            enum: ["pending", "verified", "rejected"],
            default: "pending",
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