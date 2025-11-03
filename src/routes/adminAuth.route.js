const express = require("express");

const router = express.Router();
const adminAuth = require("../controllers/adminAuth.controller");
const {
  authenticateAdminJWT,
} = require("../middlewares/admin.middleware");

router.post("/login", adminAuth.login);
router.post("/logout", authenticateAdminJWT, adminAuth.logout);

module.exports = router;

