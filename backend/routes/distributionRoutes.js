const express = require("express");
const router = express.Router();
const distributionController = require("../controllers/distributionController");

router.get("/", distributionController.getAllDistributions);
router.get("/:id", distributionController.getDistributionById);
router.post("/", distributionController.logDistribution);

module.exports = router;
