const mongoose = require("mongoose");

const campSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        location: {
            type: String,
            required: true,
            trim: true,
        },

        capacity: {
            type: Number,
            required: true,
            min: 1,
        },

        occupancy: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["active", "open", "nearly_full", "full", "closed"],
            default: "active",
        },

        facilities: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Camp", campSchema);