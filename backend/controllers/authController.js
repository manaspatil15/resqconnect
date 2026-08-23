const User = require("../models/User");

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, email, and password",
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists",
            });
        }

        const validRoles = ["citizen", "volunteer", "ngo", "rescue", "admin"];
        const userRole = role && validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : "citizen";

        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: userRole,
            phone: phone ? phone.trim() : undefined,
            isActive: true,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error registering user",
            error: error.message,
        });
    }
};

// @desc    Log in an existing user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password",
            });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "This account has been deactivated or suspended",
            });
        }

        if (role && user.role !== role.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: `User is registered as '${user.role}', not '${role}'`,
            });
        }

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error logging in",
            error: error.message,
        });
    }
};
