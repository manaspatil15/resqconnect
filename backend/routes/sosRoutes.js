const express = require("express");
const router = express.Router();
const sosController = require("../controllers/sosController");

router.post("/", sosController.createSOS);
router.get("/", sosController.getAllSOS);
router.get("/:id", sosController.getSOSById);
router.patch("/:id/status", sosController.updateSOSStatus);

module.exports = router;
