const Report = require("../models/Report");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

function generateCode(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
}

async function findReportByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await Report.findById(idParam);
        if (doc) return doc;
    }
    return await Report.findOne({ $or: [{ reportId: idParam }, { id: idParam }] });
}

// @desc    Get all reports (with filters)
// @route   GET /api/reports
exports.getAllReports = async (req, res) => {
    try {
        const { status, type, citizenId } = req.query;
        const query = {};

        if (status && status !== "all") query.status = status;
        if (type && type !== "all") query.type = { $regex: type, $options: "i" };
        if (citizenId) query.citizenId = citizenId;

        const reports = await Report.find(query)
            .populate("citizenId", "name email phone")
            .populate("verifiedBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching reports",
            error: error.message,
        });
    }
};

// @desc    Get single report by ID
// @route   GET /api/reports/:id
exports.getReportById = async (req, res) => {
    try {
        let report = null;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            report = await Report.findById(req.params.id)
                .populate("citizenId", "name email phone")
                .populate("verifiedBy", "name email");
        }
        if (!report) {
            report = await Report.findOne({ $or: [{ reportId: req.params.id }, { id: req.params.id }] })
                .populate("citizenId", "name email phone")
                .populate("verifiedBy", "name email");
        }

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching report",
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

// @desc    Submit a new disaster/incident report
// @route   POST /api/reports
exports.createReport = async (req, res) => {
    try {
        const { citizenId, type, incidentType, title, description, location } = req.body;

        const reportType = type || incidentType;
        if (!reportType || !location) {
            return res.status(400).json({
                success: false,
                message: "Please provide incident type and location",
            });
        }

        const reportId = generateCode("RPT");
        const reportTitle = title ? title.trim() : `${reportType} incident report`;

        const report = await Report.create({
            reportId,
            citizenId: citizenId || null,
            type: reportType.trim(),
            title: reportTitle,
            description: description ? String(description).trim() : "",
            location: formatLocation(location),
            status: "pending",
        });

        const reportObj = report.toObject();
        reportObj.referenceNumber = report.reportId;
        reportObj.isVerified = false;

        return res.status(201).json({
            success: true,
            message: "Report submitted successfully for verification",
            data: reportObj,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error submitting report",
            error: error.message,
        });
    }
};

// @desc    Verify a report (Admin action)
// @route   PATCH /api/reports/:id/verify
exports.verifyReport = async (req, res) => {
    try {
        const { verifiedBy } = req.body;

        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        report.status = "verified";
        report.verifiedBy = verifiedBy || null;
        report.verifiedAt = new Date();

        await report.save();

        // Create notification for the citizen who filed the report
        if (report.citizenId) {
            try {
                await Notification.create({
                    userId: report.citizenId,
                    title: "Report Verified",
                    message: `Your disaster report "${report.title}" (${report.reportId}) has been verified by the administration.`,
                    type: "success",
                    relatedType: "Report",
                    relatedId: report._id,
                });
            } catch (notifErr) {
                console.warn("Report verification notification notice:", notifErr.message);
            }
        }

        const reportObj = report.toObject();
        reportObj.referenceNumber = report.reportId;
        reportObj.isVerified = true;

        return res.status(200).json({
            success: true,
            message: `Report ${report.reportId} marked verified`,
            data: reportObj,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error verifying report",
            error: error.message,
        });
    }
};

// @desc    Reject a report (Admin action)
// @route   PATCH /api/reports/:id/reject
exports.rejectReport = async (req, res) => {
    try {
        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        report.status = "rejected";
        await report.save();

        if (report.citizenId) {
            try {
                await Notification.create({
                    userId: report.citizenId,
                    title: "Report Status Update",
                    message: `Your report "${report.title}" (${report.reportId}) could not be verified and was marked rejected.`,
                    type: "warning",
                    relatedType: "Report",
                    relatedId: report._id,
                });
            } catch (notifErr) {
                console.warn("Report rejection notification notice:", notifErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Report ${report.reportId} rejected`,
            data: report,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error rejecting report",
            error: error.message,
        });
    }
};

// @desc    Update report details
// @route   PUT /api/reports/:id
exports.updateReport = async (req, res) => {
    try {
        const { type, title, description, location, status } = req.body;
        const updateData = {};

        if (type !== undefined) updateData.type = type.trim();
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (status !== undefined) updateData.status = status;

        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        Object.assign(report, updateData);
        await report.save();

        return res.status(200).json({
            success: true,
            message: "Report updated successfully",
            data: report,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating report",
            error: error.message,
        });
    }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
exports.deleteReport = async (req, res) => {
    try {
        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        await Report.findByIdAndDelete(report._id);

        return res.status(200).json({
            success: true,
            message: "Report deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting report",
            error: error.message,
        });
    }
};
