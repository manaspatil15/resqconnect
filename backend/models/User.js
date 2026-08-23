const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["citizen", "volunteer", "ngo", "rescue", "admin"],
            default: "citizen",
        },

        phone: {
            type: String,
            trim: true,
        },

        status: {
            type: String,
            enum: ["active", "pending", "suspended", "on_leave"],
            default: "active",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);
