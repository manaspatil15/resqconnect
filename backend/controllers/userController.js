const User = require("../models/User");
const mongoose = require("mongoose");

async function findUserByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await User.findById(idParam);
        if (doc) return doc;
    }
    return await User.findOne({ $or: [{ _id: idParam }, { id: idParam }, { email: idParam }] });
}

// @desc    Get all users (with optional filtering by role, status, or search)
// @route   GET /api/users
exports.getAllUsers = async (req, res) => {
    try {
        const { role, status, isActive, search } = req.query;
        const query = {};

        if (role && role !== "all") {
            query.role = role.toLowerCase();
        }

        if (status && status !== "all") {
            query.status = status.toLowerCase();
        }

        if (isActive !== undefined) {
            query.isActive = isActive === "true";
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const users = await User.find(query).select("-password").sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message,
        });
    }
};

// @desc    Get a single user by ID
// @route   GET /api/users/:id
exports.getUserById = async (req, res) => {
    try {
        const user = await findUserByIdOrCode(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            data: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error.message,
        });
    }
};

// @desc    Update a user
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
    try {
        const { name, phone, role, status, isActive } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name.trim();
        if (phone !== undefined) updateData.phone = phone.trim();
        if (role !== undefined) updateData.role = role.toLowerCase();
        if (status !== undefined) updateData.status = status.toLowerCase();
        if (isActive !== undefined) updateData.isActive = isActive;

        const user = await findUserByIdOrCode(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        Object.assign(user, updateData);
        await user.save();

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating user",
            error: error.message,
        });
    }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
    try {
        const user = await findUserByIdOrCode(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        await User.findByIdAndDelete(user._id);

        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message,
        });
    }
};
