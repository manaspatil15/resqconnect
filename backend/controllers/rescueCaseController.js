const RescueCase = require("../models/RescueCase");
const SOS = require("../models/SOS");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

function generateCode(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
}

async function findCaseByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await RescueCase.findById(idParam);
        if (doc) return doc;
    }
    return await RescueCase.findOne({ $or: [{ caseId: idParam }, { id: idParam }] });
}

// @desc    Get all rescue cases (with filters)
// @route   GET /api/rescue-cases
exports.getAllCases = async (req, res) => {
    try {
        const { status, priority, assignedTo } = req.query;
        const query = {};

        if (status && status !== "all") query.status = status;
        if (priority && priority !== "all") query.priority = priority;
        if (assignedTo) query.assignedTo = assignedTo;

        const cases = await RescueCase.find(query)
            .populate("citizenId", "name email phone")
            .populate("assignedTo", "name email phone")
            .populate("sosId", "referenceNumber status")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: cases.length,
            data: cases,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching rescue cases",
            error: error.message,
        });
    }
};

// @desc    Get single rescue case by ID
// @route   GET /api/rescue-cases/:id
exports.getCaseById = async (req, res) => {
    try {
        let rescueCase = null;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            rescueCase = await RescueCase.findById(req.params.id)
                .populate("citizenId", "name email phone")
                .populate("assignedTo", "name email phone")
                .populate("sosId");
        }
        if (!rescueCase) {
            rescueCase = await RescueCase.findOne({ $or: [{ caseId: req.params.id }, { id: req.params.id }] })
                .populate("citizenId", "name email phone")
                .populate("assignedTo", "name email phone")
                .populate("sosId");
        }

        if (!rescueCase) {
            return res.status(404).json({
                success: false,
                message: "Rescue case not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: rescueCase,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching rescue case",
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

// @desc    Create a rescue case manually
// @route   POST /api/rescue-cases
exports.createCase = async (req, res) => {
    try {
        const { citizenId, location, description, priority, assignedTo } = req.body;

        if (!location) {
            return res.status(400).json({
                success: false,
                message: "Please provide case location",
            });
        }

        const caseId = generateCode("RS");

        const rescueCase = await RescueCase.create({
            caseId,
            citizenId: citizenId || null,
            location: formatLocation(location),
            description: description ? String(description).trim() : "Emergency rescue case",
            priority: priority || "high",
            status: assignedTo ? "assigned" : "pending",
            assignedTo: assignedTo || null,
        });

        return res.status(201).json({
            success: true,
            message: "Rescue case created successfully",
            data: rescueCase,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating rescue case",
            error: error.message,
        });
    }
};

// @desc    Update rescue case status (and sync with linked SOS)
// @route   PATCH /api/rescue-cases/:id/status
exports.updateCaseStatus = async (req, res) => {
    try {
        const { status, outcome } = req.body;
        const validStatuses = ["pending", "assigned", "in_progress", "resolved"];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const rescueCase = await findCaseByIdOrCode(req.params.id);
        if (!rescueCase) {
            return res.status(404).json({
                success: false,
                message: "Rescue case not found",
            });
        }

        rescueCase.status = status;
        if (outcome) {
            rescueCase.outcome = outcome;
        }

        if (status === "resolved") {
            rescueCase.resolvedAt = new Date();
            if (rescueCase.createdAt) {
                const diffMs = rescueCase.resolvedAt.getTime() - new Date(rescueCase.createdAt).getTime();
                rescueCase.responseTime = Math.round(diffMs / 60000); // minutes
            }
        }

        await rescueCase.save();

        // If linked to an SOS record, mirror the status
        let targetCitizenId = rescueCase.citizenId;
        if (rescueCase.sosId) {
            const updatedSos = await SOS.findByIdAndUpdate(rescueCase.sosId, { status }, { returnDocument: 'after' });
            if (updatedSos && updatedSos.citizenId && !targetCitizenId) {
                targetCitizenId = updatedSos.citizenId;
            }
        }

        // Generate citizen notification for status updates
        if (targetCitizenId) {
            try {
                const notifMessages = {
                    assigned: { title: "Rescue Team Dispatched", message: `Rescue team has been assigned to your emergency case (${rescueCase.caseId}).`, type: "info" },
                    in_progress: { title: "Rescue In Progress", message: `Rescue operations are actively in progress for case ${rescueCase.caseId}.`, type: "warning" },
                    resolved: { title: "Rescue Resolved", message: `Your emergency rescue case (${rescueCase.caseId}) has been marked resolved.`, type: "success" }
                };
                const notifInfo = notifMessages[status];
                if (notifInfo) {
                    await Notification.create({
                        userId: targetCitizenId,
                        title: notifInfo.title,
                        message: notifInfo.message,
                        type: notifInfo.type,
                        relatedType: "RescueCase",
                        relatedId: rescueCase._id
                    });
                }
            } catch (notifErr) {
                console.warn("Notification creation notice:", notifErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Rescue case updated to '${status}' and synced with SOS`,
            data: rescueCase,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating rescue case status",
            error: error.message,
        });
    }
};

// @desc    Assign responder to a rescue case
// @route   PATCH /api/rescue-cases/:id/assign
exports.assignCase = async (req, res) => {
    try {
        const { assignedTo } = req.body;

        if (!assignedTo) {
            return res.status(400).json({
                success: false,
                message: "Please provide assignedTo user ID",
            });
        }

        const rescueCase = await findCaseByIdOrCode(req.params.id);
        if (!rescueCase) {
            return res.status(404).json({
                success: false,
                message: "Rescue case not found",
            });
        }

        if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
            rescueCase.assignedTo = assignedTo;
        }
        if (rescueCase.status === "pending") {
            rescueCase.status = "assigned";
        }

        await rescueCase.save();

        if (rescueCase.sosId && rescueCase.status === "assigned") {
            await SOS.findByIdAndUpdate(rescueCase.sosId, { status: "assigned" });
        }

        return res.status(200).json({
            success: true,
            message: "Rescue case assigned successfully",
            data: rescueCase,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error assigning rescue case",
            error: error.message,
        });
    }
};
