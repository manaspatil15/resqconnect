const mongoose = require("mongoose");

const distributionSchema = new mongoose.Schema(
    {
        distributionId: {
            type: String,
            required: true,
            unique: true,
        },

        ngoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        campId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Camp",
            required: true,
        },

        inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: true,
        },

        itemName: {
            type: String,
            required: true,
            trim: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },

        distributedAt: {
            type: Date,
            default: Date.now,
        },

        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Distribution", distributionSchema);