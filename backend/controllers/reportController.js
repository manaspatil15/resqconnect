const Report = require("../models/Report");
const Notification = require("../models/Notification");
const User = require("../models/User");
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

async function notifyRoles(roles, { title, message, type, relatedType, relatedId }) {
    try {
        const users = await User.find({ role: { $in: roles }, isActive: true });
        if (!users.length) return;
        const notifications = users.map((u) => ({
            userId: u._id,
            title,
            message,
            type: type || "info",
            isRead: false,
            relatedType: relatedType || "Report",
            relatedId: relatedId || null,
        }));
        await Notification.insertMany(notifications);
    } catch (err) {
        console.warn("Notification dispatch notice:", err.message);
    }
}

async function notifyUser(userId, { title, message, type, relatedType, relatedId }) {
    if (!userId) return;
    try {
        await Notification.create({
            userId,
            title,
            message,
            type: type || "info",
            isRead: false,
            relatedType: relatedType || "Report",
            relatedId: relatedId || null,
        });
    } catch (err) {
        console.warn("User notification notice:", err.message);
    }
}

// Role-based privacy scrubber for missing person records
function sanitizeReportForRole(reportDoc, role, requestingUserId) {
    const raw = reportDoc.toObject ? reportDoc.toObject() : Object.assign({}, reportDoc);
    const isOwner = requestingUserId && raw.citizenId && (
        String(raw.citizenId._id || raw.citizenId) === String(requestingUserId)
    );
    const isAdmin = role && role.toLowerCase() === "admin";

    // Standardize frontend friendly fields
    raw.id = raw.reportId || raw.id || (raw._id ? raw._id.toString() : "");
    raw.name = raw.personName || raw.title || "Unknown";
    raw.lastSeen = raw.lastSeenLocation || raw.location || "Unknown Location";
    raw.lastSeenAt = raw.lastSeenAt || raw.createdAt;

    if (!isAdmin && !isOwner) {
        // Privacy rule: hide private contact phone and email for non-admin viewers
        if (raw.contactPhone) raw.contactPhone = "[Confidential]";
        if (raw.citizenId && typeof raw.citizenId === "object") {
            raw.citizenId = {
                _id: raw.citizenId._id,
                name: raw.citizenId.name || "Citizen Reporter",
                // omit phone & email
            };
        }
    }

    return raw;
}

// @desc    Get all reports (with filters)
// @route   GET /api/reports
exports.getAllReports = async (req, res) => {
    try {
        const { status, type, citizenId, role, userId } = req.query;
        const query = {};

        if (status && status !== "all") query.status = status;
        if (type && type !== "all") {
            if (type.toLowerCase() === "missing" || type.toLowerCase() === "missing person") {
                query.type = { $regex: "missing", $options: "i" };
            } else {
                query.type = { $regex: type, $options: "i" };
            }
        }
        if (citizenId) query.citizenId = citizenId;

        const reports = await Report.find(query)
            .populate("citizenId", "name email phone")
            .populate("verifiedBy", "name email")
            .sort({ createdAt: -1 });

        const sanitized = reports.map((r) => sanitizeReportForRole(r, role, userId));

        return res.status(200).json({
            success: true,
            count: sanitized.length,
            data: sanitized,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching reports",
            error: error.message,
        });
    }
};

// @desc    Get all missing persons specifically
// @route   GET /api/reports/missing-persons
exports.getAllMissingPersons = async (req, res) => {
    try {
        const { status, search, role, userId } = req.query;
        const query = {
            $or: [
                { type: { $regex: "missing", $options: "i" } },
                { personName: { $ne: null } }
            ]
        };

        if (status && status !== "all") query.status = status;
        if (search) {
            const searchRegex = { $regex: search, $options: "i" };
            query.$and = [
                {
                    $or: [
                        { personName: searchRegex },
                        { title: searchRegex },
                        { reportId: searchRegex },
                        { location: searchRegex },
                        { lastSeenLocation: searchRegex }
                    ]
                }
            ];
        }

        const reports = await Report.find(query)
            .populate("citizenId", "name email phone")
            .populate("verifiedBy", "name email")
            .sort({ createdAt: -1 });

        const sanitized = reports.map((r) => sanitizeReportForRole(r, role, userId));

        return res.status(200).json({
            success: true,
            count: sanitized.length,
            data: sanitized,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching missing person reports",
            error: error.message,
        });
    }
};

// @desc    Get single report by ID
// @route   GET /api/reports/:id
exports.getReportById = async (req, res) => {
    try {
        const { role, userId } = req.query;
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

        const sanitized = sanitizeReportForRole(report, role, userId);

        return res.status(200).json({
            success: true,
            data: sanitized,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching report",
            error: error.message,
        });
    }
};

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

        // If it is a missing person report, forward to dedicated logic
        if (reportType.toLowerCase().includes("missing")) {
            return exports.createMissingPersonReport(req, res);
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

// @desc    Submit a new Missing Person report
// @route   POST /api/reports/missing-persons
exports.createMissingPersonReport = async (req, res) => {
    try {
        const {
            name,
            personName,
            age,
            gender,
            lastSeen,
            lastSeenLocation,
            lastSeenAt,
            description,
            photo,
            contactName,
            contactPhone,
            citizenId,
            status,
        } = req.body;

        const fullName = (personName || name || "").trim();
        const locationVal = (lastSeenLocation || lastSeen || req.body.location || "").trim();

        if (!fullName || !locationVal) {
            return res.status(400).json({
                success: false,
                message: "Please provide person's name and last seen location",
            });
        }

        const reportId = generateCode("MP");
        const seenDate = lastSeenAt ? new Date(lastSeenAt) : new Date();

        const report = await Report.create({
            reportId,
            citizenId: citizenId || null,
            type: "Missing Person",
            title: `Missing: ${fullName}`,
            description: description ? String(description).trim() : "",
            location: formatLocation(locationVal),
            status: status && ["reported", "investigating", "found", "closed"].includes(status) ? status : "reported",
            personName: fullName,
            age: age ? Number(age) : null,
            gender: gender || "Other",
            lastSeenLocation: formatLocation(locationVal),
            lastSeenAt: seenDate,
            photo: photo || null,
            contactName: contactName ? contactName.trim() : null,
            contactPhone: contactPhone ? contactPhone.trim() : null,
        });

        // 1. Notify Admins
        await notifyRoles(["admin"], {
            title: "New Missing Person Report",
            message: `Missing person case filed for ${fullName}, age ${age || "?"} (${reportId}) at ${locationVal}.`,
            type: "warning",
            relatedType: "Report",
            relatedId: report._id,
        });

        // 2. Notify Volunteer, Rescue, NGO Responders
        await notifyRoles(["volunteer", "rescue", "ngo"], {
            title: "Missing Person Alert",
            message: `Active search alert for ${fullName}, last seen at ${locationVal} (${reportId}).`,
            type: "warning",
            relatedType: "Report",
            relatedId: report._id,
        });

        // 3. Notify reporting Citizen (if known)
        if (report.citizenId) {
            await notifyUser(report.citizenId, {
                title: "Missing Person Report Submitted",
                message: `Your missing person report for ${fullName} (${reportId}) has been broadcast to emergency teams.`,
                type: "success",
                relatedType: "Report",
                relatedId: report._id,
            });
        }

        const reportObj = sanitizeReportForRole(report, "admin", citizenId);
        reportObj.referenceNumber = report.reportId;

        return res.status(201).json({
            success: true,
            message: `Missing person report ${reportId} created and broadcast successfully`,
            data: reportObj,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error submitting missing person report",
            error: error.message,
        });
    }
};

// @desc    Update Missing Person / Report status
// @route   PATCH /api/reports/:id/status
exports.updateReportStatus = async (req, res) => {
    try {
        const { status, outcome } = req.body;
        const validStatuses = ["pending", "verified", "rejected", "reported", "investigating", "found", "closed"];

        if (!status || !validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(", ")}`,
            });
        }

        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        const previousStatus = report.status;
        report.status = status.toLowerCase();
        if (report.status === "verified") {
            report.verifiedAt = new Date();
        }
        await report.save();

        const pName = report.personName || report.title || "Person";

        // Status transition notifications
        if (report.status === "found") {
            // Notify Citizen Reporter
            if (report.citizenId) {
                await notifyUser(report.citizenId, {
                    title: "Missing Person Found Safe",
                    message: `Great news! ${pName} (${report.reportId}) has been marked as Found.`,
                    type: "success",
                    relatedType: "Report",
                    relatedId: report._id,
                });
            }
            // Broadcast resolution to Admins, Volunteers, Rescue, NGOs
            await notifyRoles(["admin", "volunteer", "rescue", "ngo"], {
                title: "Missing Person Resolved",
                message: `Missing person case ${report.reportId} (${pName}) has been resolved as Found.`,
                type: "info",
                relatedType: "Report",
                relatedId: report._id,
            });
        } else if (report.status === "investigating") {
            if (report.citizenId) {
                await notifyUser(report.citizenId, {
                    title: "Search Teams Mobilized",
                    message: `Search teams are actively investigating the case for ${pName} (${report.reportId}).`,
                    type: "info",
                    relatedType: "Report",
                    relatedId: report._id,
                });
            }
        } else if (report.status === "closed") {
            if (report.citizenId) {
                await notifyUser(report.citizenId, {
                    title: "Case Closed",
                    message: `Missing person case ${report.reportId} (${pName}) has been closed.`,
                    type: "info",
                    relatedType: "Report",
                    relatedId: report._id,
                });
            }
        }

        const sanitized = sanitizeReportForRole(report, "admin", null);

        return res.status(200).json({
            success: true,
            message: `Report ${report.reportId} status updated from ${previousStatus} to ${report.status}`,
            data: sanitized,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating report status",
            error: error.message,
        });
    }
};

// @desc    Mark a missing person as found
// @route   PATCH /api/reports/:id/found
exports.markPersonFound = async (req, res) => {
    req.body.status = "found";
    return exports.updateReportStatus(req, res);
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
        const { type, title, description, location, status, personName, age, gender, lastSeenLocation, lastSeenAt, photo, contactName, contactPhone } = req.body;
        const updateData = {};

        if (type !== undefined) updateData.type = type.trim();
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (status !== undefined) updateData.status = status;
        if (personName !== undefined) updateData.personName = personName.trim();
        if (age !== undefined) updateData.age = Number(age);
        if (gender !== undefined) updateData.gender = gender;
        if (lastSeenLocation !== undefined) updateData.lastSeenLocation = lastSeenLocation.trim();
        if (lastSeenAt !== undefined) updateData.lastSeenAt = new Date(lastSeenAt);
        if (photo !== undefined) updateData.photo = photo;
        if (contactName !== undefined) updateData.contactName = contactName.trim();
        if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim();

        const report = await findReportByIdOrCode(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found",
            });
        }

        Object.assign(report, updateData);
        await report.save();

        const sanitized = sanitizeReportForRole(report, "admin", null);

        return res.status(200).json({
            success: true,
            message: "Report updated successfully",
            data: sanitized,
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
