const express = require("express");
const router = express.Router();
const rescueCaseController = require("../controllers/rescueCaseController");

router.get("/", rescueCaseController.getAllCases);
router.get("/:id", rescueCaseController.getCaseById);
router.post("/", rescueCaseController.createCase);
router.patch("/:id/status", rescueCaseController.updateCaseStatus);
router.patch("/:id/assign", rescueCaseController.assignCase);

module.exports = router;
