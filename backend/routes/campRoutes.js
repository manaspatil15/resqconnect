const express = require("express");
const router = express.Router();
const campController = require("../controllers/campController");

router.get("/", campController.getAllCamps);
router.get("/:id", campController.getCampById);
router.post("/", campController.createCamp);
router.put("/:id", campController.updateCamp);
router.delete("/:id", campController.deleteCamp);

module.exports = router;
