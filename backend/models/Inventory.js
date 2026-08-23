const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
    {
        itemId: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            default: "General",
            trim: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 0,
        },

        capacity: {
            type: Number,
            required: true,
            min: 0,
        },

        unit: {
            type: String,
            default: "units",
            trim: true,
        },

        lowStockThreshold: {
            type: Number,
            default: 10,
            min: 0,
        },

        ngoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Inventory", inventorySchema);