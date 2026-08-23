const VolunteerTask = require("../models/VolunteerTask");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

function generateCode(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
}

async function findTaskByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await VolunteerTask.findById(idParam);
        if (doc) return doc;
    }
    return await VolunteerTask.findOne({ $or: [{ taskId: idParam }, { id: idParam }] });
}

// @desc    Get all volunteer tasks (with filters)
// @route   GET /api/tasks
exports.getAllTasks = async (req, res) => {
    try {
        const { status, priority, volunteerId } = req.query;
        const query = {};

        if (status && status !== "all") query.status = status;
        if (priority && priority !== "all") query.priority = priority;
        if (volunteerId) query.volunteerId = volunteerId;

        const tasks = await VolunteerTask.find(query)
            .populate("volunteerId", "name email phone")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching volunteer tasks",
            error: error.message,
        });
    }
};

// @desc    Get single volunteer task by ID
// @route   GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
    try {
        let task = null;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            task = await VolunteerTask.findById(req.params.id).populate("volunteerId", "name email phone");
        }
        if (!task) {
            task = await VolunteerTask.findOne({ $or: [{ taskId: req.params.id }, { id: req.params.id }] }).populate("volunteerId", "name email phone");
        }

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Volunteer task not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: task,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching volunteer task",
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

// @desc    Create a new volunteer task
// @route   POST /api/tasks
exports.createTask = async (req, res) => {
    try {
        const { title, description, location, priority, urgency, dueDate, volunteerId, assignedTo } = req.body;

        if (!title || !location) {
            return res.status(400).json({
                success: false,
                message: "Please provide task title and location",
            });
        }

        const taskId = generateCode("TSK");
        const assignedVolunteer = volunteerId || assignedTo || null;
        const taskPriority = priority || urgency || "medium";

        const task = await VolunteerTask.create({
            taskId,
            title: title.trim(),
            description: description ? String(description).trim() : "",
            location: formatLocation(location),
            priority: taskPriority,
            status: assignedVolunteer ? "accepted" : "available",
            volunteerId: assignedVolunteer,
            dueDate: dueDate ? new Date(dueDate) : null,
        });

        return res.status(201).json({
            success: true,
            message: "Volunteer task created successfully",
            data: task,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating volunteer task",
            error: error.message,
        });
    }
};

// @desc    Update task status (accept, start, complete)
// @route   PATCH /api/tasks/:id/status
exports.updateTaskStatus = async (req, res) => {
    try {
        const { status, volunteerId, assignedTo } = req.body;
        const validStatuses = ["available", "accepted", "in_progress", "completed"];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const task = await findTaskByIdOrCode(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Volunteer task not found",
            });
        }

        task.status = status;

        const assignedVolunteer = volunteerId || assignedTo;
        if (assignedVolunteer && mongoose.Types.ObjectId.isValid(assignedVolunteer)) {
            task.volunteerId = assignedVolunteer;
        }

        if (status === "completed") {
            task.completedAt = new Date();
        }

        await task.save();

        // Create volunteer notification for task status milestones
        const targetVolId = (task.volunteerId && (task.volunteerId._id || task.volunteerId)) || (assignedVolunteer && mongoose.Types.ObjectId.isValid(assignedVolunteer) ? assignedVolunteer : null);
        if (targetVolId && mongoose.Types.ObjectId.isValid(targetVolId)) {
            try {
                const notifMessages = {
                    accepted: { title: "Task Accepted", message: `You have accepted task "${task.title}" (${task.taskId}).`, type: "info" },
                    in_progress: { title: "Task In Progress", message: `Task "${task.title}" is now active.`, type: "info" },
                    completed: { title: "Task Completed", message: `You completed task "${task.title}". Great work!`, type: "success" }
                };
                const notifInfo = notifMessages[status];
                if (notifInfo) {
                    await Notification.create({
                        userId: targetVolId,
                        title: notifInfo.title,
                        message: notifInfo.message,
                        type: notifInfo.type,
                        relatedType: "VolunteerTask",
                        relatedId: task._id
                    });
                }
            } catch (notifErr) {
                console.warn("Volunteer notification notice:", notifErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Task updated to '${status}'`,
            data: task,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating task status",
            error: error.message,
        });
    }
};

// @desc    Update task details
// @route   PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
    try {
        const { title, description, location, priority, dueDate, volunteerId, status } = req.body;
        const updateData = {};

        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (priority !== undefined) updateData.priority = priority;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (volunteerId !== undefined) updateData.volunteerId = volunteerId;
        if (status !== undefined) {
            updateData.status = status;
            if (status === "completed") updateData.completedAt = new Date();
        }

        let task = await findTaskByIdOrCode(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Volunteer task not found",
            });
        }

        Object.assign(task, updateData);
        await task.save();

        return res.status(200).json({
            success: true,
            message: "Volunteer task updated successfully",
            data: task,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating volunteer task",
            error: error.message,
        });
    }
};

// @desc    Delete volunteer task
// @route   DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
    try {
        const task = await findTaskByIdOrCode(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Volunteer task not found",
            });
        }

        await VolunteerTask.findByIdAndDelete(task._id);

        return res.status(200).json({
            success: true,
            message: "Volunteer task deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting volunteer task",
            error: error.message,
        });
    }
};
