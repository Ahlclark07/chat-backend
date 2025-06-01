const express = require("express");
const router = express.Router();
const clientController = require("../controllers/client.controller");
const { authenticateJWT } = require("../middlewares/auth.middleware");

router.get("/me", authenticateJWT, clientController.me);
router.put("/me", authenticateJWT, clientController.updateMe);

module.exports = router;
