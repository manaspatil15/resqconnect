const Notification = require("../models/Notification");

// @desc    Get all notifications (with optional filters)
// @route   GET /api/notifications
exports.getNotifications = async (req, res) => {
    try {
        const { userId, isRead } = req.query;
        const query = {};

        if (userId) query.userId = userId;
        if (isRead !== undefined) query.isRead = isRead === "true";

        const notifications = await Notification.find(query)
            .populate("userId", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching notifications",
            error: error.message,
        });
    }
};

// @desc    Create a new notification
// @route   POST /api/notifications
exports.createNotification = async (req, res) => {
    try {
        const { userId, title, message, type, relatedType, relatedId } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({
                success: false,
                message: "Please provide userId, title, and message",
            });
        }

        const notification = await Notification.create({
            userId,
            title: title.trim(),
            message: message.trim(),
            type: type || "info",
            isRead: false,
            relatedType: relatedType || null,
            relatedId: relatedId || null,
        });

        return res.status(201).json({
            success: true,
            message: "Notification created successfully",
            data: notification,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating notification",
            error: error.message,
        });
    }
};

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: notification,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating notification",
            error: error.message,
        });
    }
};

// @desc    Mark all notifications as read for a user
// @route   PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.body;

        const query = { isRead: false };
        if (userId) {
            query.userId = userId;
        }

        const result = await Notification.updateMany(query, { isRead: true });

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} notifications marked as read`,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error marking notifications as read",
            error: error.message,
        });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting notification",
            error: error.message,
        });
    }
};
