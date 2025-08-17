const express = require("express");
const router = express.Router();
const controller = require("../controllers/autoMessage.controller");
const { authenticateAdminJWT } = require("../middlewares/admin.middleware");

router.get("/auto-messages", authenticateAdminJWT, controller.list);
router.post("/auto-messages", authenticateAdminJWT, controller.create);
router.patch("/auto-messages/:id", authenticateAdminJWT, controller.update);
router.delete("/auto-messages/:id", authenticateAdminJWT, controller.remove);

module.exports = router;

