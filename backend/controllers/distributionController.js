const Distribution = require("../models/Distribution");
const Inventory = require("../models/Inventory");
const Camp = require("../models/Camp");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

function generateCode(prefix) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${rand}`;
}

async function findDistributionByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await Distribution.findById(idParam);
        if (doc) return doc;
    }
    return await Distribution.findOne({ $or: [{ distributionId: idParam }, { id: idParam }] });
}

// @desc    Get all distribution logs (with filters)
// @route   GET /api/distributions
exports.getAllDistributions = async (req, res) => {
    try {
        const { ngoId, campId } = req.query;
        const query = {};

        if (ngoId) query.ngoId = ngoId;
        if (campId) query.campId = campId;

        const distributions = await Distribution.find(query)
            .populate("ngoId", "name email")
            .populate("campId", "name location")
            .populate("inventoryId", "name unit category")
            .sort({ distributedAt: -1 });

        return res.status(200).json({
            success: true,
            count: distributions.length,
            data: distributions,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching distributions",
            error: error.message,
        });
    }
};

// @desc    Get single distribution log by ID
// @route   GET /api/distributions/:id
exports.getDistributionById = async (req, res) => {
    try {
        const distribution = await findDistributionByIdOrCode(req.params.id);
        if (!distribution) {
            return res.status(404).json({
                success: false,
                message: "Distribution log not found",
            });
        }

        await distribution.populate("ngoId", "name email");
        await distribution.populate("campId", "name location");
        await distribution.populate("inventoryId");

        return res.status(200).json({
            success: true,
            data: distribution,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching distribution log",
            error: error.message,
        });
    }
};

// @desc    Log a new distribution (checks stock and decrements inventory)
// @route   POST /api/distributions
exports.logDistribution = async (req, res) => {
    try {
        const { ngoId, campId, camp: campField, inventoryId, itemId, itemName, item: itemField, quantity, notes } = req.body;

        const targetInventoryId = inventoryId || itemId;
        const targetCampId = campId || campField;

        if (!targetInventoryId || !targetCampId || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "Please provide camp, inventory item, and quantity",
            });
        }

        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive number",
            });
        }

        // Verify inventory item exists (by ObjectId or itemId code or name)
        let inventory = null;
        if (targetInventoryId && mongoose.Types.ObjectId.isValid(targetInventoryId)) {
            inventory = await Inventory.findById(targetInventoryId);
        }
        if (!inventory) {
            inventory = await Inventory.findOne({
                $or: [{ itemId: targetInventoryId }, { name: targetInventoryId }, { name: itemName || itemField }],
            });
        }

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found",
            });
        }

        // Core business rule: check stock availability
        if (inventory.quantity < qty) {
            return res.status(400).json({
                success: false,
                message: `Not enough stock — only ${inventory.quantity} ${inventory.unit} available.`,
            });
        }

        // Verify camp exists (by ObjectId or name)
        let camp = null;
        if (targetCampId && mongoose.Types.ObjectId.isValid(targetCampId)) {
            camp = await Camp.findById(targetCampId);
        }
        if (!camp) {
            camp = await Camp.findOne({ name: targetCampId });
        }

        if (!camp) {
            // If camp not found in DB by name, find existing or create a placeholder camp
            camp = await Camp.findOne();
            if (!camp) {
                camp = await Camp.create({
                    name: String(targetCampId),
                    location: "Relief Zone",
                    capacity: 500,
                    occupancy: 50,
                });
            }
        }

        // Deduct quantity from inventory
        inventory.quantity -= qty;
        await inventory.save();

        const distributionId = generateCode("DIST");

        const distribution = await Distribution.create({
            distributionId,
            ngoId: ngoId || inventory.ngoId || null,
            campId: camp._id,
            inventoryId: inventory._id,
            itemName: itemName || itemField || inventory.name,
            quantity: qty,
            distributedAt: new Date(),
            notes: notes ? String(notes).trim() : undefined,
        });

        // Generate notifications for NGO
        const targetNgoId = (ngoId && mongoose.Types.ObjectId.isValid(ngoId) ? ngoId : null) ||
                            (inventory.ngoId && (inventory.ngoId._id || (mongoose.Types.ObjectId.isValid(inventory.ngoId) ? inventory.ngoId : null)));
        if (targetNgoId) {
            try {
                // 1. Distribution logged confirmation
                await Notification.create({
                    userId: targetNgoId,
                    title: "Distribution Logged",
                    message: `${qty} ${inventory.unit} of "${inventory.name}" dispatched to ${camp.name}.`,
                    type: "info",
                    relatedType: "Distribution",
                    relatedId: distribution._id,
                });

                // 2. Low stock alert if stock reached threshold
                if (inventory.quantity <= inventory.lowStockThreshold) {
                    await Notification.create({
                        userId: targetNgoId,
                        title: "Low Stock Alert",
                        message: `Inventory item "${inventory.name}" (${inventory.itemId}) is low on stock (${inventory.quantity} ${inventory.unit} remaining).`,
                        type: "warning",
                        relatedType: "Inventory",
                        relatedId: inventory._id,
                    });
                }
            } catch (notifErr) {
                console.warn("Distribution notification notice:", notifErr.message);
            }
        }

        const distObj = distribution.toObject();
        distObj.referenceNumber = distribution.distributionId;

        return res.status(201).json({
            success: true,
            message: `Distribution logged: ${qty} ${inventory.unit} of ${inventory.name} dispatched to ${camp.name}`,
            data: distObj,
            remainingInventory: inventory,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error logging distribution",
            error: error.message,
        });
    }
};
