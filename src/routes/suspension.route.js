const express = require("express");
const router = express.Router();
const controller = require("../controllers/suspension.controller");
const { authenticateAdminJWT, authorizeRole } = require("../middlewares/admin.middleware");

router.get("/suspensions/last", controller.getLast);

router.get(
  "/admin/suspensions",
  authenticateAdminJWT,
  authorizeRole("god", "superadmin"),
  controller.listAll
);

module.exports = router;
