const SOS = require("../models/SOS");
const RescueCase = require("../models/RescueCase");

function generateCode(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
}

// @desc    Create a new SOS request and automatically spawn a linked RescueCase
// @route   POST /api/sos
exports.createSOS = async (req, res) => {
    try {
        const { citizenId, location, description, priority } = req.body;

        let locationStr = "Location unavailable";
        if (typeof location === "string" && location.trim().length > 0) {
            locationStr = location.trim();
        } else if (location && typeof location === "object") {
            if (location.address) {
                locationStr = location.address;
            } else if (location.latitude != null && location.longitude != null) {
                const lat = typeof location.latitude === "number" ? location.latitude.toFixed(4) : location.latitude;
                const lng = typeof location.longitude === "number" ? location.longitude.toFixed(4) : location.longitude;
                locationStr = `${lat}, ${lng}`;
            }
        }

        const referenceNumber = generateCode("SOS");
        const caseId = generateCode("RS");

        // 1. Create the SOS record
        const sos = new SOS({
            referenceNumber,
            citizenId: citizenId || null,
            location: locationStr,
            description: description ? String(description).trim() : "Emergency SOS request",
            priority: priority || "critical",
            status: "pending",
        });

        // 2. Automatically create the matching RescueCase
        const rescueCase = new RescueCase({
            caseId,
            sosId: sos._id,
            citizenId: citizenId || null,
            location: locationStr,
            description: description ? String(description).trim() : `SOS emergency triggered at ${locationStr}`,
            priority: priority || "critical",
            status: "pending",
        });

        // 3. Link them together
        sos.linkedRescueCaseId = rescueCase._id;

        await sos.save();
        await rescueCase.save();

        return res.status(201).json({
            success: true,
            message: "SOS triggered successfully and rescue case created",
            data: sos,
            rescueCase,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating SOS request",
            error: error.message,
        });
    }
};

// @desc    Get all SOS requests (with filters)
// @route   GET /api/sos
exports.getAllSOS = async (req, res) => {
    try {
        const { status, priority, citizenId } = req.query;
        const query = {};

        if (status && status !== "all") query.status = status;
        if (priority && priority !== "all") query.priority = priority;
        if (citizenId) query.citizenId = citizenId;

        const list = await SOS.find(query)
            .populate("citizenId", "name email phone")
            .populate("linkedRescueCaseId", "caseId status assignedTo")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: list.length,
            data: list,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching SOS requests",
            error: error.message,
        });
    }
};

// @desc    Get single SOS request by ID
// @route   GET /api/sos/:id
exports.getSOSById = async (req, res) => {
    try {
        const sos = await SOS.findById(req.params.id)
            .populate("citizenId", "name email phone")
            .populate("linkedRescueCaseId");

        if (!sos) {
            return res.status(404).json({
                success: false,
                message: "SOS request not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: sos,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching SOS request",
            error: error.message,
        });
    }
};

// @desc    Update SOS status
// @route   PATCH /api/sos/:id/status
exports.updateSOSStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ["pending", "assigned", "in_progress", "resolved"];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const sos = await SOS.findById(req.params.id);
        if (!sos) {
            return res.status(404).json({
                success: false,
                message: "SOS request not found",
            });
        }

        sos.status = status;
        await sos.save();

        // If linked to a RescueCase, mirror the status update
        if (sos.linkedRescueCaseId) {
            const patch = { status };
            if (status === "resolved") {
                patch.resolvedAt = new Date();
            }
            await RescueCase.findByIdAndUpdate(sos.linkedRescueCaseId, patch);
        }

        return res.status(200).json({
            success: true,
            message: "SOS status updated successfully",
            data: sos,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating SOS status",
            error: error.message,
        });
    }
};
