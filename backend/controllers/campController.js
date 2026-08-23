const Camp = require("../models/Camp");
const mongoose = require("mongoose");

async function findCampByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await Camp.findById(idParam);
        if (doc) return doc;
    }
    return await Camp.findOne({ $or: [{ _id: idParam }, { id: idParam }, { name: idParam }] });
}

// @desc    Get all relief camps
// @route   GET /api/camps
exports.getAllCamps = async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};

        if (status && status !== "all") {
            query.status = status.toLowerCase();
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { location: { $regex: search, $options: "i" } },
            ];
        }

        const camps = await Camp.find(query).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: camps.length,
            data: camps,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching relief camps",
            error: error.message,
        });
    }
};

// @desc    Get single camp by ID
// @route   GET /api/camps/:id
exports.getCampById = async (req, res) => {
    try {
        const camp = await findCampByIdOrCode(req.params.id);
        if (!camp) {
            return res.status(404).json({
                success: false,
                message: "Relief camp not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: camp,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching relief camp",
            error: error.message,
        });
    }
};

function formatLocation(location) {
    if (!location) return "Location unavailable";
    if (typeof location === "string") return location.trim();
    if (typeof location === "object") {
        if (location.address) return String(location.address).trim();
        if (location.latitude != null && location.longitude != null) {
            const lat = typeof location.latitude === "number" ? location.latitude.toFixed(4) : location.latitude;
            const lng = typeof location.longitude === "number" ? location.longitude.toFixed(4) : location.longitude;
            return `${lat}, ${lng}`;
        }
    }
    return String(location).trim();
}

// @desc    Create a new relief camp
// @route   POST /api/camps
exports.createCamp = async (req, res) => {
    try {
        const { name, location, capacity, occupancy, facilities, status } = req.body;

        if (!name || !location || capacity === undefined) {
            return res.status(400).json({
                success: false,
                message: "Please provide camp name, location, and capacity",
            });
        }

        const capNumber = Number(capacity);
        if (isNaN(capNumber) || capNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: "Capacity must be a positive number",
            });
        }

        const camp = await Camp.create({
            name: name.trim(),
            location: formatLocation(location),
            capacity: capNumber,
            occupancy: occupancy !== undefined ? Number(occupancy) : 0,
            facilities: Array.isArray(facilities) ? facilities : [],
            status: status || "active",
        });

        return res.status(201).json({
            success: true,
            message: "Relief camp created successfully",
            data: camp,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating relief camp",
            error: error.message,
        });
    }
};

// @desc    Update a relief camp
// @route   PUT /api/camps/:id
exports.updateCamp = async (req, res) => {
    try {
        const { name, location, capacity, occupancy, facilities, status } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name.trim();
        if (location !== undefined) updateData.location = formatLocation(location);
        if (capacity !== undefined) updateData.capacity = Number(capacity);
        if (occupancy !== undefined) updateData.occupancy = Number(occupancy);
        if (facilities !== undefined) updateData.facilities = Array.isArray(facilities) ? facilities : [];
        if (status !== undefined) updateData.status = status;

        if (updateData.occupancy !== undefined && updateData.capacity !== undefined) {
            if (updateData.occupancy >= updateData.capacity) {
                updateData.status = "full";
            }
        }

        const camp = await findCampByIdOrCode(req.params.id);
        if (!camp) {
            return res.status(404).json({
                success: false,
                message: "Relief camp not found",
            });
        }

        Object.assign(camp, updateData);
        await camp.save();

        return res.status(200).json({
            success: true,
            message: "Relief camp updated successfully",
            data: camp,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating relief camp",
            error: error.message,
        });
    }
};

// @desc    Delete a relief camp
// @route   DELETE /api/camps/:id
exports.deleteCamp = async (req, res) => {
    try {
        const camp = await findCampByIdOrCode(req.params.id);
        if (!camp) {
            return res.status(404).json({
                success: false,
                message: "Relief camp not found",
            });
        }

        await Camp.findByIdAndDelete(camp._id);

        return res.status(200).json({
            success: true,
            message: "Relief camp deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting relief camp",
            error: error.message,
        });
    }
};
