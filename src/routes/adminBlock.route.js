const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminBlock.controller");
const {
  authenticateAdminJWT,
  authorizeRole,
} = require("../middlewares/admin.middleware");

router.get(
  "/blocks",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.list
);

router.delete(
  "/blocks/:id",
  authenticateAdminJWT,
  authorizeRole("superadmin", "god"),
  controller.remove
);

module.exports = router;
