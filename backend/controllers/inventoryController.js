const Inventory = require("../models/Inventory");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

function generateCode(prefix) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
}

async function findInventoryByIdOrCode(idParam) {
    if (!idParam) return null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await Inventory.findById(idParam);
        if (doc) return doc;
    }
    return await Inventory.findOne({ $or: [{ itemId: idParam }, { id: idParam }, { name: idParam }] });
}

// @desc    Get all inventory items (with optional filters)
// @route   GET /api/inventory
exports.getAllInventory = async (req, res) => {
    try {
        const { category, ngoId, lowStock } = req.query;
        const query = {};

        if (category && category !== "all") {
            query.category = category;
        }

        if (ngoId) {
            query.ngoId = ngoId;
        }

        let items = await Inventory.find(query).populate("ngoId", "name email").sort({ createdAt: -1 });

        if (lowStock === "true") {
            items = items.filter((i) => i.quantity <= i.lowStockThreshold);
        }

        return res.status(200).json({
            success: true,
            count: items.length,
            data: items,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching inventory items",
            error: error.message,
        });
    }
};

// @desc    Get single inventory item by ID
// @route   GET /api/inventory/:id
exports.getInventoryById = async (req, res) => {
    try {
        const item = await findInventoryByIdOrCode(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: item,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching inventory item",
            error: error.message,
        });
    }
};

// @desc    Add a new inventory item
// @route   POST /api/inventory
exports.createInventory = async (req, res) => {
    try {
        const { name, item: itemField, itemName, category, quantity, capacity, unit, lowStockThreshold, thresholdValue, ngoId } = req.body;
        const resolvedName = name || itemField || itemName;

        if (!resolvedName || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "Please provide item name and quantity",
            });
        }

        const qty = Number(quantity);
        if (isNaN(qty) || qty < 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a non-negative number",
            });
        }

        const cap = capacity !== undefined ? Number(capacity) : qty;
        const itemId = generateCode("INV");
        const threshold = lowStockThreshold !== undefined ? Number(lowStockThreshold) : (thresholdValue !== undefined ? Number(thresholdValue) : 10);

        const item = await Inventory.create({
            itemId,
            name: resolvedName.trim(),
            category: category ? category.trim() : "General Supplies",
            quantity: qty,
            capacity: cap,
            unit: unit ? unit.trim() : "units",
            lowStockThreshold: threshold,
            ngoId: ngoId || null,
        });

        // Generate notification for NGO
        const targetNgoId = (ngoId && mongoose.Types.ObjectId.isValid(ngoId) ? ngoId : null) ||
                            (item.ngoId && (item.ngoId._id || (mongoose.Types.ObjectId.isValid(item.ngoId) ? item.ngoId : null)));
        if (targetNgoId) {
            try {
                await Notification.create({
                    userId: targetNgoId,
                    title: "Inventory Stock Added",
                    message: `Added ${qty} ${item.unit} of "${item.name}" to inventory (${item.itemId}).`,
                    type: "success",
                    relatedType: "Inventory",
                    relatedId: item._id,
                });
            } catch (notifErr) {
                console.warn("Inventory notification notice:", notifErr.message);
            }
        }

        const itemObj = item.toObject();
        itemObj.referenceNumber = item.itemId;
        itemObj.itemName = item.name;
        itemObj.item = item.name;

        return res.status(201).json({
            success: true,
            message: "Inventory item added successfully",
            data: itemObj,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating inventory item",
            error: error.message,
        });
    }
};

// @desc    Update an inventory item
// @route   PUT /api/inventory/:id
exports.updateInventory = async (req, res) => {
    try {
        const { name, category, quantity, capacity, unit, lowStockThreshold, ngoId } = req.body;
        const updateData = {};

        if (name !== undefined) updateData.name = name.trim();
        if (category !== undefined) updateData.category = category.trim();
        if (quantity !== undefined) updateData.quantity = Number(quantity);
        if (capacity !== undefined) updateData.capacity = Number(capacity);
        if (unit !== undefined) updateData.unit = unit.trim();
        if (lowStockThreshold !== undefined) updateData.lowStockThreshold = Number(lowStockThreshold);
        if (ngoId !== undefined) updateData.ngoId = ngoId;

        const item = await findInventoryByIdOrCode(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found",
            });
        }

        Object.assign(item, updateData);
        await item.save();

        return res.status(200).json({
            success: true,
            message: "Inventory item updated successfully",
            data: item,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating inventory item",
            error: error.message,
        });
    }
};

// @desc    Delete an inventory item
// @route   DELETE /api/inventory/:id
exports.deleteInventory = async (req, res) => {
    try {
        const item = await findInventoryByIdOrCode(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Inventory item not found",
            });
        }

        await Inventory.findByIdAndDelete(item._id);

        return res.status(200).json({
            success: true,
            message: "Inventory item deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting inventory item",
            error: error.message,
        });
    }
};
