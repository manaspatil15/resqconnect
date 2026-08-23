const express = require("express");
const router = express.Router();
const volunteerTaskController = require("../controllers/volunteerTaskController");

router.get("/", volunteerTaskController.getAllTasks);
router.get("/:id", volunteerTaskController.getTaskById);
router.post("/", volunteerTaskController.createTask);
router.patch("/:id/status", volunteerTaskController.updateTaskStatus);
router.put("/:id", volunteerTaskController.updateTask);
router.delete("/:id", volunteerTaskController.deleteTask);

module.exports = router;
