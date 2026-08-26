const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

// Missing persons specific routes (declared before /:id param)
router.get("/missing-persons", reportController.getAllMissingPersons);
router.post("/missing-persons", reportController.createMissingPersonReport);

router.get("/", reportController.getAllReports);
router.get("/:id", reportController.getReportById);
router.post("/", reportController.createReport);
router.patch("/:id/status", reportController.updateReportStatus);
router.patch("/:id/found", reportController.markPersonFound);
router.patch("/:id/verify", reportController.verifyReport);
router.patch("/:id/reject", reportController.rejectReport);
router.put("/:id", reportController.updateReport);
router.delete("/:id", reportController.deleteReport);

module.exports = router;
